// src/services/fileService.js
import XLSX from "xlsx";
import { logMessage } from "../logger/logger.js";
import { BitrixUtils } from "../utils/bx.js";
import { decryptText } from "../utils/crypto.js";

// Константы для заголовков полей, задаются через переменные окружения
const ACCESS_PRODUCT_ID_FIELD_KEY =
    process.env.ACCESS_PRODUCT_ID_FIELD_KEY || "ZutatenLagerID";
const ACCESS_PRODUCT_NAME_FIELD_KEY =
    process.env.ACCESS_PRODUCT_NAME_FIELD_KEY || "ZutatenLager";
const ACCESS_PRODUCT_AMOUNT_TO_BUY_FIELD_KEY =
    process.env.ACCESS_PRODUCT_AMOUNT_TO_BUY_FIELD_KEY || "ZutLagBestellen";
const ACCESS_PRODUCT_PRICE_FIELD_KEY =
    process.env.ACCESS_PRODUCT_PRICE_FIELD_KEY || "ZutatenLager_Tagespreis";
const ACCESS_PRODUCT_MEASURE_FIELD_KEY =
    process.env.ACCESS_PRODUCT_MEASURE_FIELD_KEY || "EinheitID";

const ACCESS_SUPPLIER_ID_FIELD_KEY =
    process.env.ACCESS_SUPPLIER_ID_FIELD_KEY || "LieferantID";
const ACCESS_SUPPLIER_NAME_FIELD_KEY =
    process.env.ACCESS_SUPPLIER_NAME_FIELD_KEY || "Firma";

// Маппинг единиц измерения
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

// Парсинг XLSX или XLS файла
export const parseFile = async (
    input,
    fileType = "purchase",
    isBase64 = false
) => {
  try {
    let workbook;
    if (isBase64) {
      // Парсим base64 напрямую
      const buffer = Buffer.from(input, "base64");
      workbook = XLSX.read(buffer, { type: "buffer" });
    } else {
      // Парсим файл с диска
      workbook = XLSX.readFile(input, { type: "binary" });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rows.length === 0) {
      logMessage("warning", "parseFile", "File is empty");
      throw new Error("File is empty");
    }

    // Определяем обязательные заголовки в зависимости от типа файла
    let requiredHeaders;
    switch (fileType) {
      case "raw":
      case "packaging_labels":
        requiredHeaders = [
          ACCESS_PRODUCT_ID_FIELD_KEY,
          ACCESS_PRODUCT_NAME_FIELD_KEY,
        ];
        break;
      case "suppliers":
        requiredHeaders = [
          ACCESS_SUPPLIER_ID_FIELD_KEY,
          ACCESS_SUPPLIER_NAME_FIELD_KEY,
        ];
        break;
      case "supplier_product":
        requiredHeaders = [
          ACCESS_SUPPLIER_ID_FIELD_KEY,
          ACCESS_SUPPLIER_NAME_FIELD_KEY,
          ACCESS_PRODUCT_ID_FIELD_KEY,
          ACCESS_PRODUCT_NAME_FIELD_KEY,
        ];
        break;
      case "purchase":
      default:
        requiredHeaders = [
          ACCESS_PRODUCT_ID_FIELD_KEY,
          ACCESS_PRODUCT_NAME_FIELD_KEY,
          ACCESS_PRODUCT_AMOUNT_TO_BUY_FIELD_KEY,
        ];
        break;
    }

    let headerRowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const hasAllHeaders = requiredHeaders.every((header) =>
          row.includes(header)
      );
      if (hasAllHeaders) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      logMessage(
          "error",
          "parseFile",
          `Required headers not found in file: ${requiredHeaders.join(", ")}`
      );
      throw new Error(
          `Required headers (${requiredHeaders.join(", ")}) not found in file`
      );
    }

    const headers = rows[headerRowIndex];
    const dataRows = rows.slice(headerRowIndex + 1);

    const records = dataRows.map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index];
      });
      return record;
    });

    const filteredRecords = records.filter((record) =>
        requiredHeaders.every(
            (field) => record[field] !== undefined && record[field] != null
        )
    );

    logMessage(
        "info",
        "parseFile",
        `Parsed ${records.length} total records, ${filteredRecords.length} valid records after filtering`
    );

    if (filteredRecords.length > 0) {
      logMessage(
          "info",
          "parseFile",
          `First valid record: ${JSON.stringify(filteredRecords[0])}`
      );
    } else {
      logMessage(
          "warning",
          "parseFile",
          "No valid data rows found after headers"
      );
      throw new Error("No valid data rows found after headers");
    }

    return filteredRecords;
  } catch (error) {
    logMessage("error", "parseFile", error);
    throw error;
  }
};

// Обработка данных
export const processProducts = async (records, fileType = "purchase") => {
  try {
    const bxLinkDecrypted = await decryptText(
        process.env.BX_LINK,
        process.env.CRYPTO_KEY,
        process.env.CRYPTO_IV
    );
    const bx = new BitrixUtils(bxLinkDecrypted);

    if (fileType === "suppliers") {
      // Обработка поставщиков
      const supplierIds = records
          .map((record) => record[ACCESS_SUPPLIER_ID_FIELD_KEY])
          .filter((id) => id != null);
      const uniqueSupplierIds = [...new Set(supplierIds)];

      const bitrixContacts = await bx.getContactsByAccessIds(uniqueSupplierIds);

      const processedData = [];
      for (const record of records) {
        const supplierId = record[ACCESS_SUPPLIER_ID_FIELD_KEY];
        const supplierName =
            record[ACCESS_SUPPLIER_NAME_FIELD_KEY] || "Unknown";

        let bitrixContact = bitrixContacts.find(
            (bc) => bc[process.env.UF_CONTACT_ACCESS_ID] == supplierId
        );

        let contactId;
        if (!bitrixContact) {
          // Создаём новый контакт
          contactId = await bx.addContact({
            NAME: supplierName,
            [process.env.UF_CONTACT_ACCESS_ID]: supplierId,
          });
          bitrixContact = {
            ID: contactId,
            NAME: supplierName,
            [process.env.UF_CONTACT_ACCESS_ID]: supplierId,
          };
        } else {
          // Проверяем, отличаются ли поля
          const hasDifferences =
              bitrixContact.NAME !== supplierName ||
              bitrixContact[process.env.UF_CONTACT_ACCESS_ID] != supplierId;

          if (hasDifferences) {
            // Обновляем контакт
            await bx.updateContact(bitrixContact.ID, {
              NAME: supplierName,
              [process.env.UF_CONTACT_ACCESS_ID]: supplierId,
            });
          }
          contactId = bitrixContact.ID;
        }

        processedData.push({
          bitrix_id: contactId,
          supplier_id: supplierId,
          name: supplierName,
        });
      }

      logMessage(
          "info",
          "processProducts",
          `Processed ${processedData.length} supplier records`
      );
      return processedData;
    }

    if (fileType === "supplier_product") {
      // Обработка связки Поставщик-Товар
      // Группируем товары по поставщикам
      const suppliersMap = new Map();
      for (const record of records) {
        const supplierId = record[ACCESS_SUPPLIER_ID_FIELD_KEY];
        const supplierName =
            record[ACCESS_SUPPLIER_NAME_FIELD_KEY] || "Unknown";
        const productId = record[ACCESS_PRODUCT_ID_FIELD_KEY];
        const productName = record[ACCESS_PRODUCT_NAME_FIELD_KEY] || "Unknown";

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

      const bitrixContacts = await bx.getContactsByAccessIds(supplierIds);
      const bitrixProducts = await bx.getProductsByAccessIds(uniqueProductIds);

      // Получаем существующие сделки по CONTACT_ID
      const contactIds = bitrixContacts
          .map((c) => c.ID)
          .filter((id) => id != null);
      const existingDeals = await bx.getSmartProcessDealsByContactIds(
          1068,
          contactIds
      ); // Явно указываем entityTypeId=1068

      const processedData = [];
      for (const [supplierId, supplierData] of suppliersMap) {
        // Находим контакт
        const bitrixContact = bitrixContacts.find(
            (bc) => bc[process.env.UF_CONTACT_ACCESS_ID] == supplierId
        );

        if (!bitrixContact) {
          logMessage(
              "warning",
              "processProducts",
              `Contact with Access ID ${supplierId} not found in Bitrix`
          );
          continue;
        }

        // Формируем товары
        const products = supplierData.products
            .map((product) => {
              const bitrixProduct = bitrixProducts.find(
                  (bp) => bp[process.env.UF_PRODUCT_ACCESS_ID] == product.ACCESS_ID
              );
              if (!bitrixProduct) {
                logMessage(
                    "warning",
                    "processProducts",
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
                MEASURE_CODE: parseInt(bitrixProduct.MEASURE || 796), // Берём единицу измерения из CRM
              };
            })
            .filter((p) => p !== null);

        if (products.length === 0) {
          logMessage(
              "warning",
              "processProducts",
              `No valid products found for supplier ${supplierId}`
          );
          continue;
        }

        // Проверяем существующие сделки
        const existingDeal = existingDeals.find(
            (deal) => deal.contactId == bitrixContact.ID
        );

        let dealId;
        if (!existingDeal) {
          // Создаём новую сделку
          dealId = await bx.addSmartProcessDeal(
              1068, // entityTypeId смарт-процесса
              {
                TITLE: `Поставщик: ${supplierData.supplier_name}`,
                CONTACT_ID: bitrixContact.ID,
              },
              products
          );
        } else {
          // Сравниваем товары в сделке
          const existingProductIds = (existingDeal.productRows || []).map(
              (row) => row.productId
          );
          const newProductIds = products.map((p) => p.CRM_PRODUCT_ID); // Используем CRM_PRODUCT_ID для сравнения
          const hasDifferences =
              existingProductIds.length !== newProductIds.length ||
              !existingProductIds.every((id) => newProductIds.includes(id)) ||
              !newProductIds.every((id) => existingProductIds.includes(id));

          if (hasDifferences) {
            // Обновляем сделку
            dealId = existingDeal.id;
            await bx.updateSmartProcessDeal(
                1068,
                dealId,
                {
                  TITLE: `Поставщик: ${supplierData.supplier_name}`,
                  CONTACT_ID: bitrixContact.ID,
                },
                products
            );
          } else {
            dealId = existingDeal.id;
          }
        }

        processedData.push({
          supplier_id: supplierId,
          supplier_name: supplierData.supplier_name,
          bitrix_contact_id: bitrixContact.ID,
          bitrix_deal_id: dealId,
          products: supplierData.products,
        });
      }

      logMessage(
          "info",
          "processProducts",
          `Processed ${processedData.length} supplier-product deals`
      );
      return processedData;
    }
    if (fileType === "raw" || fileType === "packaging_labels") {
      const accessIds = records
          .map((record) => record[ACCESS_PRODUCT_ID_FIELD_KEY])
          .filter((id) => id != null);
      const uniqueAccessIds = [...new Set(accessIds)];

      const bitrixProducts = await bx.getProductsByAccessIds(uniqueAccessIds);

      for (const record of records) {
        const accessId = record[ACCESS_PRODUCT_ID_FIELD_KEY];
        const productName = record[ACCESS_PRODUCT_NAME_FIELD_KEY] || "Unknown";
        const price = record[ACCESS_PRODUCT_PRICE_FIELD_KEY] || 0;
        let bitrixProduct = bitrixProducts.find(
            (bp) => bp[process.env.UF_PRODUCT_ACCESS_ID] == accessId
        );

        let productId;
        if (!bitrixProduct) {
          // Создаём новый товар, если не найден
          productId = await bx.addProductRaw({
            NAME: productName,
            [process.env.UF_PRODUCT_ACCESS_ID]: accessId,
            PRICE: price
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
              bitrixProduct.NAME !== productName ||
              bitrixProduct[process.env.UF_PRODUCT_ACCESS_ID] != accessId;

          if (
              hasDifferences &&
              ["raw", "packaging_labels"].includes(fileType)
          ) {
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

      // Фильтрация записей: убираем null (не найденные товары)
    }

    // Обработка товаров (закупочный лист или список товаров: сырье, упаковка-наклейки)
    const accessIds = records
        .map((record) => record[ACCESS_PRODUCT_ID_FIELD_KEY])
        .filter((id) => id != null);
    const uniqueAccessIds = [...new Set(accessIds)];

    const bitrixProducts = await bx.getProductsByAccessIds(uniqueAccessIds);

    const bitrixContacts = await bx.getContactsWithAccessId();
    // console.log("bitrixContacts", JSON.stringify(bitrixContacts, null, 2)); // Для отладки

    const contactIds = bitrixContacts
        .map((c) => c.ID)
        .filter((id) => id != null);

    const existingDeals = await bx.getSmartProcessDealsByContactIdsWithProducts(
        1068,
        contactIds
    );
    const supplierMap = existingDeals.map((contact) => ({
      id: contact.contactId,
      name: contact.title,
    }));

    // console.log(existingDeals, "existingDeals"); // Для отладки

    const processedData = [];
    for (const record of records) {
      const accessId = record[ACCESS_PRODUCT_ID_FIELD_KEY];
      const productName = record[ACCESS_PRODUCT_NAME_FIELD_KEY] || "Unknown";
      const price =
          fileType === "purchase"
              ? parseFloat(record[ACCESS_PRODUCT_PRICE_FIELD_KEY]) || 0
              : parseFloat(record[ACCESS_PRODUCT_PRICE_FIELD_KEY]) || 0;
      const measureStr =
          fileType === "purchase"
              ? record[ACCESS_PRODUCT_MEASURE_FIELD_KEY] || "шт"
              : record[ACCESS_PRODUCT_MEASURE_FIELD_KEY] || "л";

      const measure = MEASURE_MAPPING[measureStr.toLowerCase()] || 9; // По умолчанию "Штука" (9), если единица не найдена

      let bitrixProduct = bitrixProducts.find(
          (bp) => bp[process.env.UF_PRODUCT_ACCESS_ID] == accessId
      );

      let productId;
      if (!bitrixProduct) {
        // Создаём новый товар, если не найден

        productId = await bx.addProduct({
          NAME: productName,
          PRICE: price,
          MEASURE: measure,
          [process.env.UF_PRODUCT_ACCESS_ID]: accessId,
        });

        bitrixProduct = {
          ID: productId,
          NAME: productName,
          PRICE: price,
          MEASURE: measure,
          [process.env.UF_PRODUCT_ACCESS_ID]: accessId,
        };
      } else {
        // Проверяем, отличаются ли поля
        const bitrixPrice =
            bitrixProduct.PRICE !== null && bitrixProduct.PRICE !== undefined
                ? parseFloat(bitrixProduct.PRICE)
                : 0;
        const hasDifferences =
            bitrixProduct.NAME !== productName ||
            bitrixPrice !== price ||
            parseInt(bitrixProduct.MEASURE || 0) !== measure ||
            bitrixProduct[process.env.UF_PRODUCT_ACCESS_ID] != accessId;

        if (
            hasDifferences &&
            ["supplier_product", "packaging_labels", "raw"].includes(fileType)
        ) {
          // Обновляем товар, если есть отличия
          await bx.updateProduct(bitrixProduct.ID, {
            NAME: productName,
            PRICE: price,
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
        suppliers: [],
      };

      if (fileType === "purchase") {
        const quantity =
            parseFloat(record[ACCESS_PRODUCT_AMOUNT_TO_BUY_FIELD_KEY]) || 0;
        if (quantity <= 0) {
          logMessage(
              "warning",
              "processProducts",
              `Invalid quantity for product ${productName}: ${record[ACCESS_PRODUCT_AMOUNT_TO_BUY_FIELD_KEY]}`
          );
        }
        result.quantity = quantity > 0 ? quantity : 0;
      } else {
        result.price = price;
        result.measure = measureStr;
      }

      processedData.push(result);
    }

    // Фильтрация записей: убираем null (не найденные товары)
    let validData = processedData.filter((item) => item !== null);
    for (const deal of existingDeals) {
      // console.log("deal", deal); // Для отладки

      const supplierInfo = supplierMap.find(
          (item) => item.id === deal.contactId
      );
      // console.log("supplierInfo", supplierInfo); // Для отладки
      // console.log("supplierInfo", supplierInfo); // Для отладки

      if (!supplierInfo || !deal.productRows) continue;

      for (const row of deal.productRows) {
        // console.log("row", row); // Для отладки

        const product = validData.find((p) => p.name == row.productName);
        // console.log("product", product); // Для отладки

        if (!product) continue;

        if (!product.suppliers) product.suppliers = [];

        const alreadyAdded = product.suppliers.some(
            (s) => s.id === supplierInfo.id
        );

        if (!alreadyAdded) {
          product.suppliers.push(supplierInfo);
        }
      }
    }
    const productMap = new Map();
    for (const product of validData) {
      const existingProduct = productMap.get(product.access_id);

      if (existingProduct) {
        // Если товар уже существует, объединяем данные
        if (fileType === "purchase" && product.quantity) {
          // Для закупочного листа суммируем количество
          existingProduct.quantity =
              (existingProduct.quantity || 0) + product.quantity;
        }

        // Объединяем поставщиков, если они разные
        if (product.suppliers && product.suppliers.length > 0) {
          const existingSupplierNames = existingProduct.suppliers.map(
              (s) => s.name
          );
          product.suppliers.forEach((supplier) => {
            if (!existingSupplierNames.includes(supplier.name)) {
              existingProduct.suppliers.push(supplier);
            }
          });
        }
      } else {
        // Если товар новый, добавляем в Map
        productMap.set(product.access_id, { ...product });
      }
    }

    // Преобразуем Map обратно в массив
    validData = Array.from(productMap.values());

    logMessage(
        "info",
        "processProducts",
        `Processed ${validData.length} unique records after merging duplicates`
    );
    return validData;
  } catch (error) {
    logMessage("error", "processProducts", error);
    throw error;
  }
};
