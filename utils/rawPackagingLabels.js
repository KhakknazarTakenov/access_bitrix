// utils/rawPackagingLabels.js
import { ProductUtils } from "./bx/products.js";
import { logMessage } from "../logger/logger.js";

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

// Обработка данных для типов "raw" и "packaging_labels"
export const processRawPackagingLabels = async (records, fileType, bxLink) => {
    const bx = new ProductUtils(bxLink);

    const accessIds = records
        .map((record) => record[process.env.ACCESS_PRODUCT_ID_FIELD_KEY])
        .filter((id) => id != null);
    const uniqueAccessIds = [...new Set(accessIds)];

    const bitrixProducts = await bx.getProductsByAccessIds(uniqueAccessIds);

    for (const record of records) {
        const accessId = record[process.env.ACCESS_PRODUCT_ID_FIELD_KEY];
        const productName = record[process.env.ACCESS_PRODUCT_NAME_FIELD_KEY] || "Unknown";
        const price = record[process.env.ACCESS_PRODUCT_PRICE_FIELD_KEY] || 0;
        let bitrixProduct = bitrixProducts.find(
            (bp) => bp[process.env.UF_PRODUCT_ACCESS_ID].value == accessId
        );
        const measureStr = record[process.env.ACCESS_PRODUCT_MEASURE_FIELD_KEY] || "шт";
        const measure = MEASURE_MAPPING[measureStr.toLowerCase()] || 9; // По умолчанию "Штука" (9)

        let productId;
        if (!bitrixProduct) {
            // Создаём новый товар, если не найден
            productId = await bx.addProduct({
                NAME: productName,
                [process.env.UF_PRODUCT_ACCESS_ID]: accessId,
                PRICE: price,
                MEASURE: measure
            });
            bitrixProduct = {
                ID: productId,
                NAME: productName,
                [process.env.UF_PRODUCT_ACCESS_ID]: accessId,
                PRICE: price
            };
        } else {
            // Проверяем, отличаются ли поля
            const hasDifferences =
                bitrixProduct.NAME.toLowerCase().trim().replace(" ", "") !== productName.toLowerCase().trim().replace(" ", "") ||
                bitrixProduct[process.env.UF_PRODUCT_ACCESS_ID].value != accessId ||
                Math.round(Number(bitrixProduct["PRICE"])) != Math.round(Number(price));

            if (
                hasDifferences &&
                ["raw", "packaging_labels"].includes(fileType)
            ) {
                console.log(price)
                // Обновляем товар, если есть отличия
                await bx.updateProduct(bitrixProduct.ID, {
                    NAME: productName,
                    [process.env.UF_PRODUCT_ACCESS_ID]: accessId,
                    PRICE: price
                });
            }
            productId = bitrixProduct.ID;
        }
    }

    return records; // Возвращаем записи, так как они уже обработаны
};