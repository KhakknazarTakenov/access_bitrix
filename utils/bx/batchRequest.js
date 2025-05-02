// bx/batchRequest.js
import { logMessage } from "../../logger/logger.js";

// Универсальная функция для выполнения batch-запросов через POST
export const batchRequest = async (bxLink, commands) => {
    try {
        const batchSize = 50; // Лимит Bitrix24 на количество команд в одном batch-запросе
        const allResults = [];

        // Разделяем команды на группы по 50
        const commandKeys = Object.keys(commands);
        for (let i = 0; i < commandKeys.length; i += batchSize) {
            const batchCommands = {};
            const batchKeys = commandKeys.slice(i, i + batchSize);
            batchKeys.forEach(key => {
                batchCommands[key] = commands[key];
            });

            // Формируем тело запроса для batch
            const body = {};
            Object.keys(batchCommands).forEach(key => {
                body[`cmd[${key}]`] = batchCommands[key];
            });

            const url = `${bxLink}/batch`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams(body).toString()
            });

            if (!response.ok) {
                throw new Error(`Batch request failed: ${response.statusText}`);
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(`Batch request error: ${JSON.stringify(data.error)}`);
            }

            const batchResults = Object.values(data.result.result).map(item => {
                if (item.error) {
                    throw new Error(`Command failed: ${JSON.stringify(item.error)}`);
                }
                return item;
            }).flat();

            allResults.push(...batchResults);
        }

        return allResults;
    } catch (error) {
        logMessage("error", "batchRequest", error);
        throw error;
    }
};