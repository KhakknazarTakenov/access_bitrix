// src/handlers/fileHandlers.js
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { logMessage } from "../logger/logger.js";
import { parseFile, processProducts } from "../services/fileService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Обработчик загрузки закупочного листа
export const uploadPurchaseHandler = async (req, res) => {
  try {
    const { filename, base64 } = req.body;

    if (!filename || !base64) {
      return res.status(400).json({
        status: false,
        status_msg: "error",
        message: "Необходимо предоставить filename и base64 данные",
      });
    }

    const ext = path.extname(filename).toLowerCase();
    if (![".xlsx", ".xls"].includes(ext)) {
      return res.status(400).json({
        status: false,
        status_msg: "error",
        message: "Только XLSX и XLS файлы разрешены!",
      });
    }

    const uploadDir = path.join(__dirname, "..", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, "purchase_list" + ext);
    const base64Data = base64.replace(/^data:.*;base64,/, "");
    await fs.promises.writeFile(filePath, base64Data, "base64");

    const parsedData = await parseFile(filePath, "purchase");
    const processedData = await processProducts(parsedData, "purchase");

    res.status(200).json({
      status: true,
      status_msg: "success",
      message: "Закупочный лист успешно загружен и обработан",
      data: processedData,
    });
  } catch (error) {
    logMessage("error", "uploadPurchaseHandler", error);
    res.status(500).json({
      status: false,
      status_msg: "error",
      message: "Ошибка сервера при загрузке закупочного листа",
      error: error.message,
    });
  }
};

// Обработчик получения обработанных данных закупочного листа
export const getProcessedPurchaseDataHandler = async (req, res) => {
  try {
    const filePathXlsx = path.join(
      __dirname,
      "..",

      "uploads",
      "purchase_list.xlsx"
    );
    const filePathXls = path.join(
      __dirname,
      "..",

      "Uploads",
      "purchase_list.xls"
    );

    const filePath = fs.existsSync(filePathXlsx)
      ? filePathXlsx
      : fs.existsSync(filePathXls)
      ? filePathXls
      : null;

    if (!filePath) {
      return res.status(404).json({
        status: false,
        status_msg: "error",
        message: "Файл не найден",
      });
    }

    const parsedData = await parseFile(filePath, "purchase");
    const processedData = await processProducts(parsedData, "purchase");

    res.status(200).json({
      status: true,
      status_msg: "success",
      message: "Данные закупочного листа успешно получены",
      data: processedData,
    });
  } catch (error) {
    logMessage("error", "getProcessedPurchaseDataHandler", error);
    res.status(500).json({
      status: false,
      status_msg: "error",
      message: "Ошибка сервера при получении данных",
      error: error.message,
    });
  }
};

// Обработчик загрузки списка сырья
export const uploadRawHandler = async (req, res) => {
  try {
    const { filename, base64 } = req.body;

    if (!filename || !base64) {
      return res.status(400).json({
        status: false,
        status_msg: "error",
        message: "Необходимо предоставить filename и base64 данные",
      });
    }

    const ext = path.extname(filename).toLowerCase();
    if (![".xlsx", ".xls"].includes(ext)) {
      return res.status(400).json({
        status: false,
        status_msg: "error",
        message: "Только XLSX и XLS файлы разрешены!",
      });
    }

    // Парсим base64 напрямую без сохранения
    const base64Data = base64.replace(/^data:.*;base64,/, "");
    const parsedData = await parseFile(base64Data, "raw", true);
    const processedData = await processProducts(parsedData, "raw");

    res.status(200).json({
      status: true,
      status_msg: "success",
      message: "Список сырья успешно обработан",
      data: processedData,
    });
  } catch (error) {
    logMessage("error", "uploadRawHandler", error);
    res.status(500).json({
      status: false,
      status_msg: "error",
      message: "Ошибка сервера при обработке списка сырья",
      error: error.message,
    });
  }
};

// Обработчик загрузки списка упаковки и наклеек
export const uploadPackagingLabelsHandler = async (req, res) => {
  try {
    const { filename, base64 } = req.body;

    if (!filename || !base64) {
      return res.status(400).json({
        status: false,
        status_msg: "error",
        message: "Необходимо предоставить filename и base64 данные",
      });
    }

    const ext = path.extname(filename).toLowerCase();
    if (![".xlsx", ".xls"].includes(ext)) {
      return res.status(400).json({
        status: false,
        status_msg: "error",
        message: "Только XLSX и XLS файлы разрешены!",
      });
    }

    // Парсим base64 напрямую без сохранения
    const base64Data = base64.replace(/^data:.*;base64,/, "");
    const parsedData = await parseFile(base64Data, "packaging_labels", true);
    const processedData = await processProducts(parsedData, "packaging_labels");

    res.status(200).json({
      status: true,
      status_msg: "success",
      message: "Список упаковки и наклеек успешно обработан",
      data: processedData,
    });
  } catch (error) {
    logMessage("error", "uploadPackagingLabelsHandler", error);
    res.status(500).json({
      status: false,
      status_msg: "error",
      message: "Ошибка сервера при обработке списка упаковки и наклеек",
      error: error.message,
    });
  }
};

// Обработчик загрузки списка поставщиков
export const uploadSuppliersHandler = async (req, res) => {
  try {
    const { filename, base64 } = req.body;

    if (!filename || !base64) {
      return res.status(400).json({
        status: false,
        status_msg: "error",
        message: "Необходимо предоставить filename и base64 данные",
      });
    }

    const ext = path.extname(filename).toLowerCase();
    if (![".xlsx", ".xls"].includes(ext)) {
      return res.status(400).json({
        status: false,
        status_msg: "error",
        message: "Только XLSX и XLS файлы разрешены!",
      });
    }

    // Парсим base64 напрямую без сохранения
    const base64Data = base64.replace(/^data:.*;base64,/, "");
    const parsedData = await parseFile(base64Data, "suppliers", true);
    const processedData = await processProducts(parsedData, "suppliers");

    res.status(200).json({
      status: true,
      status_msg: "success",
      message: "Список поставщиков успешно обработан и обновлён в Bitrix24",
      data: processedData,
    });
  } catch (error) {
    logMessage("error", "uploadSuppliersHandler", error);
    res.status(500).json({
      status: false,
      status_msg: "error",
      message: "Ошибка сервера при обработке списка поставщиков",
      error: error.message,
    });
  }
};

// Обработчик загрузки связки поставщик-товар
export const uploadSupplierProductHandler = async (req, res) => {
  try {
    const { filename, base64 } = req.body;

    if (!filename || !base64) {
      return res.status(400).json({
        status: false,
        status_msg: "error",
        message: "Необходимо предоставить filename и base64 данные",
      });
    }

    const ext = path.extname(filename).toLowerCase();
    if (![".xlsx", ".xls"].includes(ext)) {
      return res.status(400).json({
        status: false,
        status_msg: "error",
        message: "Только XLSX и XLS файлы разрешены!",
      });
    }

    // Парсим base64 напрямую без сохранения
    const base64Data = base64.replace(/^data:.*;base64,/, "");
    const parsedData = await parseFile(base64Data, "supplier_product", true);
    // const os = require("os");
    // const path = require("path");
    // const fs = require("fs");
    // const desktopPath = path.join(os.homedir(), "Desktop");
    // const outputPath = path.join(desktopPath, "output.json");
    // fs.writeFileSync(outputPath, JSON.stringify(parsedData, null, 2));
    // console.log("✅ Сохранил на рабочий стол:", outputPath);
    const processedData = await processProducts(parsedData, "supplier_product");

    res.status(200).json({
      status: true,
      status_msg: "success",
      message:
        "Связки поставщик-товар успешно обработаны и обновлены в смарт-процессе",
      data: processedData,
    });
  } catch (error) {
    logMessage("error", "uploadSupplierProductHandler", error);
    res.status(500).json({
      status: false,
      status_msg: "error",
      message: "Ошибка сервера при обработке связок поставщик-товар",
      error: error.message,
    });
  }
};
