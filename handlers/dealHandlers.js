// src/handlers/dealHandlers.js
import { logMessage } from "../logger/logger.js";
import { createDeals } from "../services/dealService.js";

// Обработчик создания сделок
export const createDealHandler = async (req, res) => {
  try {
    const products = req.body;

    if (!products) {
      return res.status(400).json({
        status: false,
        status_msg: "error",
        message: "Необходимо предоставить массив продуктов",
      });
    }

    const deals = await createDeals(JSON.parse(products.body));

    res.status(200).json({
      status: true,
      status_msg: "success",
      message: "Сделки успешно созданы",
      deals: deals,
    });
  } catch (error) {
    logMessage("error", "createDealHandler", error);
    res.status(500).json({
      status: false,
      status_msg: "error",
      message: "Ошибка сервера при создании сделок",
      error: error.message,
    });
  }
};
