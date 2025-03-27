import path from "path";
import fs from "fs";
import { logMessage } from "../logger/logger.js";
import { generateCryptoKeyAndIV, encryptText } from "../utils/crypto.js";
import { fileURLToPath } from "url";

// Определяем __dirname для ES-модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const initHandler = async (req, res) => {
    try {
        const bxLink = req.body.bx_link;
        if (!bxLink) {
            res.status(400).json({
                status: false,
                status_msg: "error",
                message: "Необходимо предоставить ссылку входящего вебхука!",
            });
            return;
        }

        const keyIv = generateCryptoKeyAndIV();
        const bxLinkEncrypted = await encryptText(
            bxLink,
            keyIv.CRYPTO_KEY,
            keyIv.CRYPTO_IV
        );

        const bxLinkEncryptedBase64 = Buffer.from(bxLinkEncrypted, "hex").toString(
            "base64"
        );

        const envPath = path.resolve(process.cwd(), ".env");
        const envContent = `CRYPTO_KEY=${keyIv.CRYPTO_KEY}\nCRYPTO_IV=${keyIv.CRYPTO_IV}\nBX_LINK=${bxLinkEncryptedBase64}\n`;

        fs.writeFileSync(envPath, envContent, "utf8");

        res.status(200).json({
            status: true,
            status_msg: "success",
            message: "Система готова работать с вашим битриксом!",
        });
    } catch (error) {
        logMessage(LOG_TYPES.E, "/access_bitrix/init", error);
        res.status(500).json({
            status: false,
            status_msg: "error",
            message: "Server error",
            error: error.message,
        });
    }
};