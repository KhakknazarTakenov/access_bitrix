// src/routes/fileRoutes.js
import express from "express";
import {
    uploadPurchaseHandler,
    getProcessedPurchaseDataHandler,
    uploadRawHandler,
    uploadPackagingLabelsHandler,
    uploadSuppliersHandler,
    uploadSupplierProductHandler
} from "../handlers/fileHandlers.js";

const router = express.Router();
const BASE_URL = "/access_bitrix/";

// Ендпоинт для загрузки закупочного листа
router.post(BASE_URL + "upload/purchase", uploadPurchaseHandler);

// Ендпоинт для получения обработанных данных из сохраненного закупочного листа
router.get(BASE_URL + "get_processed_data", getProcessedPurchaseDataHandler);

// Ендпоинт для загрузки списка сырья
router.post(BASE_URL + "upload/raw", uploadRawHandler);

// Ендпоинт для загрузки списка упаковки и наклеек
router.post(BASE_URL + "upload/packaging_labels", uploadPackagingLabelsHandler);

// Ендпоинт для загрузки списка поставщиков
router.post(BASE_URL + "upload/suppliers", uploadSuppliersHandler);

// Ендпоинт для загрузки связки поставщик-товар
router.post(BASE_URL + "upload/supplier_product", uploadSupplierProductHandler);

export default router;