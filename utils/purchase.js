// utils/purchase.js
import { ContactUtils } from "./bx/contacts.js";
import { ProductUtils } from "./bx/products.js";
import { DealUtils } from "./bx/deals.js";
import { logMessage } from "../logger/logger.js";
import { batchRequest } from "./bx/batchRequest.js";

const MEASURE_MAPPING = {
    м: 1, // Метр
    л: 3, // Литр
    г: 5, // Грамм
    кг: 7, // Килограмм
    шт: 9, // Штука
    км: 10, // Километр
    м2: 12, // Квадратный метр
    м3: 14, // Кубический метр
    т: 16, // Тонна
    ч: 18, // Час
    мес: 20, // Месяц
    кор: 22, // Коробка
    уп: 24, // Упаковка
    пара: 26, // Пара
    рул: 28, // Рулон
    тыс: 30, // Тысяча штук
    бут: 32, // Бутылка
    усл: 34, // Услуга
    кВтч: 36, // Киловатт-час
    "кВт·ч": 38, // Киловатт - час
    "кг(уп)": 40, // кг(уп)
};

// Обработка данных для типа "purchase"
export const processPurchase = async (records, bxLink) => {
    const bxContacts = new ContactUtils(bxLink);
    const bxProducts = new ProductUtils(bxLink);

    // Обработка товаров (закупочный лист)
    const accessIds = records
        .map((record) => record[process.env.ACCESS_PRODUCT_ID_FIELD_KEY])
        .filter((id) => id != null);
    const uniqueAccessIds = [...new Set(accessIds)];

    const bitrixProducts = await bxProducts.getProductsByAccessIds(uniqueAccessIds);

    const processedData = [];
    const suppliersMap = new Map();

    // Шаг 1: Формируем закупочный лист
    for (const record of records) {
        const accessId = record[process.env.ACCESS_PRODUCT_ID_FIELD_KEY];
        const productName = record[process.env.ACCESS_PRODUCT_NAME_FIELD_KEY] || "Unknown";
        const price = parseFloat(record[process.env.ACCESS_PRODUCT_PRICE_FIELD_KEY]) || 0;
        const measureStr = record[process.env.ACCESS_PRODUCT_MEASURE_FIELD_KEY] || "шт";
        const measure = MEASURE_MAPPING[measureStr.toLowerCase()] || 9; // По умолчанию "Штука" (9)

        let bitrixProduct = bitrixProducts.find(
            (bp) => bp[process.env.UF_PRODUCT_ACCESS_ID].value == accessId
        );

        let productId;
        if (!bitrixProduct) {
            // Создаём новый товар, если не найден
            productId = await bxProducts.addProduct({
                NAME: productName,
                PRICE: bitrixProduct["PRICE"],
                MEASURE: measure,
                [process.env.UF_PRODUCT_ACCESS_ID]: accessId,
            });

            bitrixProduct = {
                ID: productId,
                NAME: productName,
                PRICE: bitrixProduct["PRICE"],
                MEASURE: measure,
                [process.env.UF_PRODUCT_ACCESS_ID]: accessId,
            };
        } else {
            // Проверяем, отличаются ли поля
            const hasDifferences =
                bitrixProduct.NAME.toLowerCase().trim().replace(" ", "") !== productName.toLowerCase().trim().replace(" ", "") ||
                parseInt(bitrixProduct[process.env.UF_PRODUCT_ACCESS_ID].value) !== parseInt(accessId);

            if (hasDifferences) {
                await bxProducts.updateProduct(bitrixProduct.ID, {
                    NAME: productName,
                    PRICE: bitrixProduct["PRICE"],
                    MEASURE: measure,
                    [process.env.UF_PRODUCT_ACCESS_ID]: accessId,
                });
            }
            productId = bitrixProduct.ID;
        }

        const result = {
            bitrix_id: productId || null,
            access_id: accessId,
            name: productName,
            price: price,
            suppliers: [], // Поставщики будут добавлены позже
            quantity: parseFloat(record[process.env.ACCESS_PRODUCT_AMOUNT_TO_BUY_FIELD_KEY]) || 0,
        };

        if (result.quantity < 0) {
            logMessage(
                "warning",
                "processPurchase",
                `Invalid quantity for product ${productName}: ${record[process.env.ACCESS_PRODUCT_AMOUNT_TO_BUY_FIELD_KEY]}`
            );
        }

        processedData.push(result);
    }

    // Шаг 2: Подготавливаем каталогные товары для всех продуктов
    const allProductIds = processedData.map(product => product.bitrix_id).filter(id => id);
    const catalogProducts = await bxProducts.getCatalogProducts(allProductIds);

    const catalogProductMap = new Map(catalogProducts.map(product => [product.parentId?.value, product]));

    // Шаг 3: Получаем всех поставщиков, используя поле UF_CRM_1745481063508 (UF_IS_SUPPLIER)
    const batchSize = 50;
    const allSuppliers = [];
    let start = 0;
    let hasMore = true;

    while (hasMore) {
        const batchCommands = {
            suppliers: `crm.contact.list?filter[${process.env.UF_IS_SUPPLIER}]=1&select[]=ID&select[]=NAME&select[]=${process.env.UF_CONTACT_PRODUCT_IDS_FIELD}&start=${start}`
        };

        const batchResults = await batchRequest(bxLink, batchCommands);
        const suppliers = batchResults;

        allSuppliers.push(...suppliers);

        if (suppliers.length < batchSize) {
            hasMore = false;
        } else {
            start += batchSize;
        }
    }

    logMessage("info", "processPurchase", `Fetched ${allSuppliers.length} suppliers`);

    // Шаг 4: Группируем товары по поставщикам
    for (const product of processedData) {
        const bitrixProduct = bitrixProducts.find(
            (bp) => bp[process.env.UF_PRODUCT_ACCESS_ID].value == product.access_id
        );

        if (!bitrixProduct) continue;

        // Сопоставляем товар с поставщиками
        const suppliers = [];
        for (const supplier of allSuppliers) {
            const supplierProductIds = supplier[process.env.UF_CONTACT_PRODUCT_IDS_FIELD] || [];
            const productId = parseInt(bitrixProduct.ID);

            if (supplierProductIds.includes(productId)) {
                suppliers.push({
                    id: supplier.ID,
                    name: supplier.NAME,
                });

                if (!suppliersMap.has(supplier.ID)) {
                    suppliersMap.set(supplier.ID, {
                        supplier_id: supplier.ID,
                        supplier_name: supplier.NAME,
                        products: [],
                    });
                }

                const supplierData = suppliersMap.get(supplier.ID);
                const catalogProduct = catalogProductMap.get(bitrixProduct.ID);
                if (catalogProduct) {
                    supplierData.products.push({
                        CRM_PRODUCT_ID: bitrixProduct.ID,
                        catalogProductId: catalogProduct.id,
                        NAME: product.name,
                        QUANTITY: product.quantity,
                        PRICE: parseFloat(bitrixProduct.PRICE || 0),
                        MEASURE_CODE: parseInt(bitrixProduct.MEASURE || 796),
                    });
                }
            }
        }

        product.suppliers = suppliers;
    }

    // Возвращаем processedData и suppliersMap для дальнейшего использования
    return { processedData, suppliersMap };
};

// Создание сделок на основе suppliersMap (вызывается при нажатии кнопки "Создать сделки")
export const createDealsFromPurchase = async (suppliersMap, allSuppliers, bxLink) => {
    const bxDeals = new DealUtils(bxLink);
    const finalDeals = [];

    for (const [supplierId, supplierData] of suppliersMap) {
        const bitrixContact = allSuppliers.find(
            (bc) => bc.ID == supplierId
        );

        if (!bitrixContact) {
            logMessage(
                "warning",
                "createDealsFromPurchase",
                `Contact with ID ${supplierId} not found in Bitrix`
            );
            continue;
        }

        const dealId = await bxDeals.addDeal(
            bitrixContact.ID,
            `Закупка: ${supplierData.supplier_name}`,
            supplierData.products
        );

        finalDeals.push({
            supplier_id: supplierId,
            supplier_name: supplierData.supplier_name,
            bitrix_contact_id: bitrixContact.ID,
            bitrix_deal_id: dealId,
            products: supplierData.products,
        });
    }

    logMessage("info", "createDealsFromPurchase", `Created ${finalDeals.length} deals`);
    return finalDeals;
};