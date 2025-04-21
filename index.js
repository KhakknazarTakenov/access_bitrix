// src/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import path from "path";
import initRoutes from "./routes/initRoutes.js";
import fileRoutes from "./routes/fileRoutes.js";
import dealRoutes from "./routes/dealRoutes.js"; // Новые маршруты

import "./global.js";

const app = express();
const port = 6734;

const envPath = path.join(process.cwd(), ".env");
dotenv.config({ path: envPath });
app.use(cors({ origin: "*" }));
app.use(express.json());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Подключаем маршруты
app.use(initRoutes);
app.use(fileRoutes);
app.use(dealRoutes); // Подключаем маршруты для сделок

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
