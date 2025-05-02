// src/services/fileService.js
import { decryptText } from "../utils/crypto.js";
import { processSuppliers } from "../utils/suppliers.js";
import { processSupplierProduct } from "../utils/supplierProduct.js";
import { processRawPackagingLabels } from "../utils/rawPackagingLabels.js";
import { processPurchase } from "../utils/purchase.js";
import { logMessage } from "../logger/logger.js";
import * as XLSX from "xlsx";
import fs from "fs";

// Парсинг XLSX или XLS файла
export const parseFile = async (input, fileType = "purchase", isBase64 = false) => {
  try {
    let workbook;
    if (isBase64) {
      // Парсим Base64-данные
      const buffer = Buffer.from(input, "base64");
      workbook = XLSX.read(buffer, { type: "buffer" });
    } else {
      // Читаем файл с диска как буфер и парсим
      const fileBuffer = fs.readFileSync(input);
      workbook = XLSX.read(fileBuffer, { type: "buffer" });
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
          process.env.ACCESS_PRODUCT_ID_FIELD_KEY,
          process.env.ACCESS_PRODUCT_NAME_FIELD_KEY,
          process.env.ACCESS_PRODUCT_PRICE_FIELD_KEY
        ];
        break;
      case "suppliers":
        requiredHeaders = [
          process.env.ACCESS_SUPPLIER_ID_FIELD_KEY,
          process.env.ACCESS_SUPPLIER_NAME_FIELD_KEY,
        ];
        break;
      case "supplier_product":
        requiredHeaders = [
          process.env.ACCESS_SUPPLIER_ID_FIELD_KEY,
          process.env.ACCESS_SUPPLIER_NAME_FIELD_KEY,
          process.env.ACCESS_PRODUCT_ID_FIELD_KEY,
          process.env.ACCESS_PRODUCT_NAME_FIELD_KEY,
        ];
        break;
      case "purchase":
      default:
        requiredHeaders = [
          process.env.ACCESS_PRODUCT_ID_FIELD_KEY,
          process.env.ACCESS_PRODUCT_NAME_FIELD_KEY,
          process.env.ACCESS_PRODUCT_PRICE_FIELD_KEY,
          process.env.ACCESS_PRODUCT_AMOUNT_TO_BUY_FIELD_KEY,
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
          LOG_TYPES.E,
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
        LOG_TYPES.I,
        "parseFile",
        `Parsed ${records.length} total records, ${filteredRecords.length} valid records after filtering`
    );

    if (filteredRecords.length > 0) {
      logMessage(
          LOG_TYPES.I,
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
    logMessage(LOG_TYPES.E, "parseFile", error);
    throw error;
  }
};

// Точка входа для обработки данных
export const processProducts = async (records, fileType = "purchase") => {
  try {
    const bxLinkDecrypted = await decryptText(
        process.env.BX_LINK,
        process.env.CRYPTO_KEY,
        process.env.CRYPTO_IV
    );

    let processedData;
    switch (fileType) {
      case "suppliers":
        processedData = await processSuppliers(records, bxLinkDecrypted);
        break;
      case "supplier_product":
        processedData = await processSupplierProduct(records, bxLinkDecrypted);
        break;
      case "raw":
      case "packaging_labels":
        processedData = await processRawPackagingLabels(records, fileType, bxLinkDecrypted);
        break;
      case "purchase":
      default:
        processedData = await processPurchase(records, bxLinkDecrypted);
        break;
    }
    logMessage(
        LOG_TYPES.I,
        "processProducts",
        `Processed ${processedData.length} records for fileType ${fileType}`
    );
    return processedData;
  } catch (error) {
    logMessage(LOG_TYPES.E, "processProducts", error);
    throw error;
  }
};