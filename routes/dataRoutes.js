import express from "express";
import { getAllProductsHandler, getAllProvidersHandler, testHandler } from "../handlers/dataHandlers.js";

const router = express.Router();
const BASE_URL = "/access_bitrix/";

router.get(BASE_URL + "get_all_products/", getAllProductsHandler);
router.get(BASE_URL + "get_all_product_providers/", getAllProvidersHandler);
router.get(BASE_URL + "test/", testHandler);

export default router;