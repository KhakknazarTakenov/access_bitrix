import express from "express";
import { initHandler } from "../handlers/initHandlers.js";

const router = express.Router();
const BASE_URL = "/access_bitrix/";

router.post(BASE_URL + "init/", initHandler);

export default router;