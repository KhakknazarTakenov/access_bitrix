import express from "express";
import { processProductsHandler } from "../handlers/dataHandlers.js"; // Добавляем новый обработчик

const router = express.Router();
const BASE_URL = "/access_bitrix/";

// Новый эндпоинт для обработки продуктов
router.get(BASE_URL + "get_all_products/", processProductsHandler);

export default router;