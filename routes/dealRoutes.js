// src/routes/dealRoutes.js
import express from "express";
import { createDealHandler } from "../handlers/dealHandlers.js";

const router = express.Router();
const BASE_URL = "/access_bitrix/";

// Ендпоинт для создания сделок
router.post(BASE_URL + "create_deals", createDealHandler);

export default router;