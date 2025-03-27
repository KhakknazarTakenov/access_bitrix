import express from "express";
import initRoutes from "./initRoutes.js";
import uploadRoutes from "./uploadRoutes.js";
import dataRoutes from "./dataRoutes.js";

const router = express.Router();

// Подключаем маршруты
router.use(initRoutes);
router.use(uploadRoutes);
router.use(dataRoutes);

export default router;