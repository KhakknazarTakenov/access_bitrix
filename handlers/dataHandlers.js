import path from "path";
import fs from "fs";
import XLSX from "xlsx";
import { logMessage } from "../logger/logger.js";
import { BitrixUtils } from "../utils/bx.js";
import { decryptText } from "../utils/crypto.js";
import { getAccessProductsData, getAccessProvidersData } from "../utils/msAccess.js";
import { fileURLToPath } from "url";

// Определяем __dirname для ES-модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Функция для связывания данных о товарах
const linkProductsData = async () => {
    try {
        const bxLinkDecrypted = await decryptText(
            process.env.BX_LINK,
            process.env.CRYPTO_KEY,
            process.env.CRYPTO_IV
        );
        const bx = new BitrixUtils(bxLinkDecrypted);

        const bitrixData = await bx.getAllProductsFromSection(214);
        const accessData = await getAccessProductsData();

        const productsFilePath = path.join(__dirname, "..", "uploads", "products.xlsx");

        let productsData = [];

        if (fs.existsSync(productsFilePath)) {
            productsData = readXLSX(productsFilePath);
        }

        const linkedData = accessData
            .map((accessItem) => {
                const bitrixItem = bitrixData.find((bitrixItem) => {
                    if (
                        bitrixItem.NAME.replace(" ", "").toLowerCase() ===
                        accessItem.ZutatenLager.replace(" ", "").toLowerCase()
                    ) {
                        return bitrixItem;
                    }
                });

                if (bitrixItem) {
                    return {
                        access_id: accessItem.ZutatenLagerID,
                        bitrix_id: bitrixItem.ID,
                        name: bitrixItem.NAME,
                    };
                }
                return null;
            })
            .filter((item) => item !== null);

        return linkedData;
    } catch (error) {
        logMessage(LOG_TYPES.E, "linkProductsData", error);
        return [];
    }
};

// Функция для связывания данных о поставщиках
const linkProvidersData = async () => {
    try {
        const bxLinkDecrypted = await decryptText(
            process.env.BX_LINK,
            process.env.CRYPTO_KEY,
            process.env.CRYPTO_IV
        );
        const bx = new BitrixUtils(bxLinkDecrypted);

        const accessProviders = await getAccessProvidersData();
        const bitrixProviders = await bx.getAllProviders();

        const suppliersFilePath = path.join(__dirname, "..", "uploads", "suppliers.xlsx");
        let suppliersData = [];

        if (fs.existsSync(suppliersFilePath)) {
            suppliersData = readXLSX(suppliersFilePath);
        }

        const linkedData = accessProviders
            .map((accessProvider) => {
                const bitrixItem = bitrixProviders.find((bitrixItem) => {
                    const fullName =
                        (bitrixItem.NAME ? bitrixItem.NAME : "") +
                        (bitrixItem.LAST_NAME ? bitrixItem.LAST_NAME : "");
                    if (
                        fullName.replace(" ", "").toLowerCase() ===
                        accessProvider.Firma.replace(" ", "").toLowerCase()
                    ) {
                        return bitrixItem;
                    }
                });

                const supplier = suppliersData.find(
                    (s) => s.SupplierID === accessProvider.LieferantID
                );

                if (bitrixItem) {
                    return {
                        access_id: accessProvider.LieferantID,
                        bitrix_id: bitrixItem.ID,
                        name: bitrixItem.NAME,
                        supplier_details: supplier
                            ? { supplier_id: supplier.SupplierID, supplier_name: supplier.SupplierName }
                            : null,
                    };
                }
                return null;
            })
            .filter((item) => item !== null);

        return linkedData;
    } catch (error) {
        logMessage(LOG_TYPES.E, "linkProvidersData", error);
        return [];
    }
};

export const getAllProductsHandler = async (req, res) => {
    try {
        const data = await linkProductsData();
        if (data && data.length > 0) {
            res.status(200).json({
                status: true,
                status_msg: "success",
                data: data,
            });
        } else {
            throw new Error("No products found or error while getting products");
        }
    } catch (error) {
        logMessage(LOG_TYPES.E, "get_all_products", error);
        res.status(500).json({
            status: false,
            status_msg: "error",
            message: "Internal server error",
            error: error.message,
        });
    }
};

export const getAllProvidersHandler = async (req, res) => {
    try {
        const data = await linkProvidersData();
        if (data && data.length > 0) {
            res.status(200).json({
                status: true,
                status_msg: "success",
                data: data,
            });
        } else {
            throw new Error("No providers found or error while getting providers");
        }
    } catch (error) {
        logMessage(LOG_TYPES.E, "get_all_product_providers", error);
        res.status(500).json({
            status: false,
            status_msg: "error",
            message: "Internal server error",
            error: error.message,
        });
    }
};

export const testHandler = async (req, res) => {
    try {
        res.status(200).json({
            status: true,
            status_msg: "success",
            message: "Test endpoint is working",
        });
    } catch (error) {
        logMessage(LOG_TYPES.E, "test", error);
        res.status(500).json({
            status: false,
            status_msg: "error",
            message: "Internal server error",
            error: error.message,
        });
    }
};