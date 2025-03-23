import express from 'express';
import cors from "cors";
import dotenv from 'dotenv';
import bodyParser from "body-parser";
import path from "path";
import fs from 'fs';

import {logMessage} from "./logger/logger.js";
import { BitrixUtils } from "./utils/bx.js";
import { generateCryptoKeyAndIV, encryptText, decryptText } from "./utils/crypto.js";
import './global.js'
import {getAccessProductsData, getAccessProvidersData} from "./utils/msAccess.js";

const app = express();
const port = 6734;

const envPath = path.join(process.cwd(), '.env');
dotenv.config({ path: envPath });

app.use(express.json());
app.use(cors({
    origin: "*",
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const BASE_URL = "/access_bitrix/";

app.post(BASE_URL + "init/", async (req, res) => {
    try {
        const bxLink = req.body.bx_link;
        if (!bxLink) {
            res.status(400).json({
                "status": false,
                "status_msg": "error",
                "message": "Необходимо предоставить ссылку входящего вебхука!"
            });
            return;
        }

        const keyIv = generateCryptoKeyAndIV();
        const bxLinkEncrypted = await encryptText(bxLink, keyIv.CRYPTO_KEY, keyIv.CRYPTO_IV);

        const bxLinkEncryptedBase64 = Buffer.from(bxLinkEncrypted, 'hex').toString('base64');

        const envPath = path.resolve(process.cwd(), '.env');
        const envContent = `CRYPTO_KEY=${keyIv.CRYPTO_KEY}\nCRYPTO_IV=${keyIv.CRYPTO_IV}\nBX_LINK=${bxLinkEncryptedBase64}\n`;

        fs.writeFileSync(envPath, envContent, 'utf8');

        res.status(200).json({
            "status": true,
            "status_msg": "success",
            "message": "Система готова работать с вашим битриксом!",
        });
    } catch (error) {
        logMessage(LOG_TYPES.E, BASE_URL + "/init", error);
        res.status(500).json({
            "status": false,
            "status_msg": "error",
            "message": "Server error"
        });
    }
});

app.get(BASE_URL + "get_all_products/", async (req, res) => {
    try {
        let data = await linkProductsData();
        if (data) {
            res.status(200).json({ "status": true, "status_msg": "success", "data": data });
        } else {
            throw new Error("Error while getting products")
        }
    } catch (error) {
        logMessage(LOG_TYPES.E, "get_all_products", error);
        res.status(500).json({ "status": false, "status_msg": "error", "message": "Internal server error", "error": error });
    }
})

app.get(BASE_URL + "get_all_product_providers/", async (req, res) => {
    try {
        let data = await linkProvidersData();
        if (data) {
            res.status(200).json({"status": true, "status_msg": "success", "data": data});
        } else {
            throw new Error("Error while getting providers")
        }
    } catch (error) {
        logMessage(LOG_TYPES.E, "get_all_product_providers", error);
        res.status(500).json({ "status": false, "status_msg": "error", "message": "Internal server error", "error": error });
    }
})

app.get(BASE_URL + "test/", async (req, res) => {
    try {
    } catch (error) {
        logMessage(LOG_TYPES.E, 'test', error);
        res.status(500).json({
            status: false,
            status_msg: 'error',
            message: 'Internal server error',
            error: error.message
        });
    }
})

async function linkProvidersData() {
    try {
        const bxLinkDecrypted = await decryptText(process.env.BX_LINK, process.env.CRYPTO_KEY, process.env.CRYPTO_IV);
        const bx = new BitrixUtils(bxLinkDecrypted);

        const accessProviders = await getAccessProvidersData();
        const bitrixProviders = await bx.getAllProviders();
        return accessProviders.map(accessProvider => {
            const bitrixItem = bitrixProviders.find(bitrixItem => {
                const fullName = bitrixItem.NAME ? bitrixItem.NAME : "" + bitrixItem.LAST_NAME ? bitrixItem.LAST_NAME : "";
                if (fullName.replace(" ", "").toLowerCase() === accessProvider.Firma.replace(" ", "").toLowerCase()) {
                    return bitrixItem;
                }
            });
            if (bitrixItem) {
                return {
                    access_id: accessProvider.LieferantID,
                    bitrix_id: bitrixItem.ID,
                    name: bitrixItem.NAME
                };
            } return null;
        }).filter(item => item !== null);

    } catch (error) {
        logMessage(LOG_TYPES.E, "linkProductsData", error);
        return [];
    }
}

async function linkProductsData() {
    try {
        const bxLinkDecrypted = await decryptText(process.env.BX_LINK, process.env.CRYPTO_KEY, process.env.CRYPTO_IV);
        const bx = new BitrixUtils(bxLinkDecrypted);
        const accessData = await getAccessProductsData();
        const bitrixData = await bx.getAllProductsFromSection(214);

        return accessData
            .map(accessItem => {
                const bitrixItem = bitrixData.find(bitrixItem => {
                    if (bitrixItem.NAME.replace(" ", "").toLowerCase() === accessItem.ZutatenLager.replace(" ", "").toLowerCase()) {
                        // console.log(bitrixItem)
                        return bitrixItem;
                    }
                });
                if (bitrixItem) {
                    return {
                        access_id: accessItem.ZutatenLagerID,
                        bitrix_id: bitrixItem.ID,
                        name: bitrixItem.NAME
                    };
                } return null;
            }).filter(item => item !== null);
    } catch (error) {
        logMessage(LOG_TYPES.E, "linkProductsData", error);
        return [];
    }
}

app.listen(port, () => {
    console.log(`App listening on port ${port}`);
})