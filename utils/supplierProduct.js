// utils/supplierProduct.js
import { ContactUtils } from "./bx/contacts.js";
import { ProductUtils } from "./bx/products.js";
import { logMessage } from "../logger/logger.js";

// Обработка данных для типа "supplier_product"
export const processSupplierProduct = async (records, bxLink) => {
    const bxContacts = new ContactUtils(bxLink);
    const bxProducts = new ProductUtils(bxLink);

    // Группируем товары по поставщикам
    const suppliersMap = new Map();
    for (const record of records) {
        const supplierId = record[process.env.ACCESS_SUPPLIER_ID_FIELD_KEY];
        const supplierName = record[process.env.ACCESS_SUPPLIER_NAME_FIELD_KEY] || "Unknown";
        const productId = record[process.env.ACCESS_PRODUCT_ID_FIELD_KEY];
        const productName = record[process.env.ACCESS_PRODUCT_NAME_FIELD_KEY] || "Unknown";

        if (!suppliersMap.has(supplierId)) {
            suppliersMap.set(supplierId, {
                supplier_id: supplierId,
                supplier_name: supplierName,
                products: [],
            });
        }

        suppliersMap.get(supplierId).products.push({
            ACCESS_ID: productId, // ZutatenLagerID
            NAME: productName, // ZutatenLager
            QUANTITY: 1, // По умолчанию 1
        });
    }

    // Получаем контакты и товары из Bitrix24
    const supplierIds = Array.from(suppliersMap.keys());
    const productIds = Array.from(suppliersMap.values()).flatMap((s) =>
        s.products.map((p) => p.ACCESS_ID)
    );
    const uniqueProductIds = [...new Set(productIds)];

    const bitrixContacts = await bxContacts.getContactsByAccessIds(supplierIds);
    const bitrixProducts = await bxProducts.getProductsByAccessIds(uniqueProductIds);
    const bitrixProductsMap = new Map(bitrixProducts.map(product => [product[process.env.UF_PRODUCT_ACCESS_ID].value, product]));
    // Получаем мапу supplierId -> productIds для всех поставщиков
    const supplierProductIdsMap = await bxContacts.getSupplierProducts(bitrixContacts.map(c => Number(c.ID)));

    const processedData = [];
    for (const [supplierId, supplierData] of suppliersMap) {
        // Находим контакт
        const bitrixContact = bitrixContacts.find(
            (bc) => bc[process.env.UF_CONTACT_ACCESS_ID] == supplierId
        );

        if (!bitrixContact) {
            logMessage(
                LOG_TYPES.W,
                "processSupplierProduct",
                `Contact with Access ID ${supplierId} not found in Bitrix`
            );
            continue;
        }

        // Формируем товары для текущего поставщика из файла
        const productsFromFile = supplierData.products
            .map((product) => {
                const bitrixProduct = bitrixProductsMap.get(product.ACCESS_ID.toString());
                if (!bitrixProduct) {
                    logMessage(
                        LOG_TYPES.W,
                        "processSupplierProduct",
                        `Product with Access ID ${product.ACCESS_ID} not found in Bitrix`
                    );
                    return null;
                }
                return {
                    CRM_PRODUCT_ID: bitrixProduct.ID, // ID товара CRM для parentId
                    ACCESS_ID: product.ACCESS_ID, // Для отображения
                    NAME: product.NAME, // Для отображения
                    QUANTITY: product.QUANTITY,
                    PRICE: parseFloat(bitrixProduct.PRICE || 0), // Берём цену из CRM
                    MEASURE_CODE: parseInt(bitrixProduct.MEASURE || 9), // Берём единицу измерения из CRM
                };
            })
            .filter((p) => p !== null);

        if (productsFromFile.length === 0) {
            logMessage(
                LOG_TYPES.W,
                "processSupplierProduct",
                `No valid products found for supplier ${supplierId}`
            );
            continue;
        }

        // Получаем текущие ID товаров поставщика из Bitrix (поле UF_CRM_1746032831962)
        const currentProductIds = supplierProductIdsMap.get(Number(bitrixContact.ID)) || [];

        // Извлекаем новые ID товаров из файла
        const newProductIds = productsFromFile.map(p => Number(p.CRM_PRODUCT_ID));

        // Определяем, какие товары нужно добавить (которых ещё нет в карточке контакта)
        const productsToAdd = newProductIds.filter(id => !currentProductIds.includes(id));

        // Если есть новые товары, добавляем их в поле UF_CRM_1746032831962
        if (productsToAdd.length > 0) {
            const updatedProductIds = [...currentProductIds, ...productsToAdd];
            await bxContacts.updateContact(bitrixContact.ID, {
                [process.env.UF_CONTACT_ACCESS_ID]: supplierId,
                [process.env.UF_CONTACT_PRODUCT_IDS_FIELD]: updatedProductIds
            });
            logMessage(
                LOG_TYPES.I,
                "processSupplierProduct",
                `Added ${productsToAdd.length} new products to contact ID ${bitrixContact.ID}`
            );
        }

        processedData.push({
            supplier_id: supplierId,
            supplier_name: supplierData.supplier_name,
            bitrix_contact_id: bitrixContact.ID,
            products: productsFromFile,
        });
    }

    return processedData;
};