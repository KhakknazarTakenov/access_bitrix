import path from "path";
import fs from "fs";
import { logMessage } from "../logger/logger.js"; // Предполагаю, что у тебя есть логгер
import { fileURLToPath } from "url";

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

// Первый эндпоинт: загрузка файла продуктов
export const uploadProductsHandler = async (req, res) => {
    try {
        const { filename, base64 } = req.body;

        // Проверка наличия всех необходимых данных
        if (!filename || !base64) {
            return res.status(400).json({
                status: false,
                status_msg: "error",
                message: "Необходимо предоставить filename и base64 данные",
            });
        }

        // Проверка расширения файла
        if (path.extname(filename).toLowerCase() !== ".xlsx") {
            return res.status(400).json({
                status: false,
                status_msg: "error",
                message: "Только XLSX-файлы разрешены!",
            });
        }

        // Создаем директорию uploads, если ее нет
        const uploadDir = path.join(__dirname, "..", "uploads");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Путь для сохранения файла
        const filePath = path.join(uploadDir, "products.xlsx");

        // Сохраняем файл
        await saveFileFromBase64(base64, filePath);

        // Возвращаем успешный ответ без обработки данных (это для второго эндпоинта)
        res.status(200).json({
            status: true,
            status_msg: "success",
            message: "Файл с товарами успешно загружен",
            filePath: filePath,
        });
    } catch (error) {
        logMessage(LOG_TYPES.E, "/access_bitrix/upload/products", error); // Логируем ошибку
        res.status(500).json({
            status: false,
            status_msg: "error",
            message: "Ошибка сервера при загрузке файла",
            error: error.message,
        });
    }
};