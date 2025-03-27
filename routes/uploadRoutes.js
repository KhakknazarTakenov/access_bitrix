import express from "express";
import { uploadProductsHandler, uploadSuppliersHandler } from "../handlers/uploadHandlers.js";

const router = express.Router();
const BASE_URL = "/access_bitrix/";

router.post(BASE_URL + "upload/products", uploadProductsHandler);
router.post(BASE_URL + "upload/suppliers", uploadSuppliersHandler);

export default router;