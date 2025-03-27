import path from "path";
import fs from "fs";
import { logMessage } from "../logger/logger.js";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

// Определяем __dirname для ES-модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Функция для сохранения файла из base64
const saveFileFromBase64 = (base64Data, filePath) => {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, base64Data, "base64", (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

// Функция для чтения XLSX-файла
const readXLSX = (filePath) => {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // Берем первый лист
        const sheet = workbook.Sheets[sheetName];
        const records = XLSX.utils.sheet_to_json(sheet); // Преобразуем в JSON
        return records;
    } catch (error) {
        throw new Error(`Ошибка при чтении XLSX: ${error.message}`);
    }
};

export const uploadProductsHandler = async (req, res) => {
    try {
        const { filename, type, base64 } = req.body;
        if (!filename || !type || !base64) {
            return res.status(400).json({
                status: false,
                status_msg: "error",
                message: "Необходимо предоставить filename, type и base64 данные",
            });
        }

        if (path.extname(filename).toLowerCase() !== ".xlsx") {
            return res.status(400).json({
                status: false,
                status_msg: "error",
                message: "Только XLSX-файлы разрешены!",
            });
        }

        const uploadDir = path.join(__dirname, "..", "uploads");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }

        const filePath = path.join(uploadDir, "products.xlsx");
        await saveFileFromBase64(base64, filePath);

        const records = readXLSX(filePath);

        res.status(200).json({
            status: true,
            status_msg: "success",
            message: "Файл с товарами успешно загружен и обработан",
            filePath: filePath,
            data: records,
        });
    } catch (error) {
        logMessage(LOG_TYPES.E, "/access_bitrix/upload/products", error);
        res.status(500).json({
            status: false,
            status_msg: "error",
            message: "Ошибка сервера при загрузке файла",
            error: error.message,
        });
    }
};

export const uploadSuppliersHandler = async (req, res) => {
    try {
        const { filename, type, base64 } = req.body;
        if (!filename || !type || !base64) {
            return res.status(400).json({
                status: false,
                status_msg: "error",
                message: "Необходимо предоставить filename, type и base64 данные",
            });
        }

        if (path.extname(filename).toLowerCase() !== ".xlsx") {
            return res.status(400).json({
                status: false,
                status_msg: "error",
                message: "Только XLSX-файлы разрешены!",
            });
        }

        const uploadDir = path.join(__dirname, "..", "uploads");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }

        const filePath = path.join(uploadDir, "suppliers.xlsx");
        await saveFileFromBase64(base64, filePath);

        const records = readXLSX(filePath);

        res.status(200).json({
            status: true,
            status_msg: "success",
            message: "Файл с поставщиками успешно загружен и обработан",
            filePath: filePath,
            data: records,
        });
    } catch (error) {
        logMessage(LOG_TYPES.E, "/access_bitrix/upload/suppliers", error);
        res.status(500).json({
            status: false,
            status_msg: "error",
            message: "Ошибка сервера при загрузке файла",
            error: error.message,
        });
    }
};