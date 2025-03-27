import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import path from "path";

import routes from "./routes/index.js";
import "./global.js";

const app = express();
const port = 6734;

const envPath = path.join(process.cwd(), ".env");
dotenv.config({ path: envPath });

app.use(express.json());
app.use(
    cors({
        origin: "*",
    })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Подключаем маршруты
app.use(routes);

app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});