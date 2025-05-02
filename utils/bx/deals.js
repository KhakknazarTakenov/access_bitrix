// bx/deals.js
import { logMessage } from "../../logger/logger.js";
import { batchRequest } from "./batchRequest.js";

export class DealUtils {
    constructor(bxLink) {
        this.bxLink = bxLink;
    }

    // Создание сделки (DEAL) для закупочного листа
    async addDeal(contactId, title, products, isChecked = false, deliveryDate = null) {
        try {
            // Шаг 1: Создаём сделку с привязкой к контакту
            let batchCommands = {
                create_deal: `crm.deal.add?fields[TITLE]=${encodeURIComponent(title)}&fields[CONTACT_ID]=${contactId}&fields[CATEGORY_ID]=12&fields[${process.env.BITRIX_PRICE_REQUEST_UF_ID}]=${isChecked ? "Y" : "N"}&fields[${process.env.BITRIX_DELIVERY_DATE_UF_ID}]=${deliveryDate || ""}`
            };

            const batchResults = await batchRequest(this.bxLink, batchCommands);
            const dealId = batchResults[0];

            if (!dealId) {
                throw new Error("Failed to create deal in Bitrix24");
            }

            // Шаг 2: Добавляем товары в сделку через crm.deal.productrows.set
            if (products && products.length > 0) {
                const productRows = products
                    .map((product, index) => {
                        if (!product.bitrix_id) {
                            logMessage(
                                "warning",
                                "bx/addDeal",
                                `Bitrix product ID not provided for product ${product.NAME} (CRM_PRODUCT_ID: ${product.CRM_PRODUCT_ID})`
                            );
                            return null;
                        }
                        return `rows[${index}][PRODUCT_ID]=${product.bitrix_id}&rows[${index}][QUANTITY]=${product.QUANTITY || 1}&rows[${index}][PRICE]=${product.PRICE || 0}&rows[${index}][MEASURE_CODE]=${product.MEASURE_CODE || 796}&fields[ASSIGNED_BY_ID]=122`;
                    })
                    .filter(row => row !== null)
                    .join("&");

                if (productRows) {
                    batchCommands = {
                        set_products: `crm.deal.productrows.set?id=${dealId}&${productRows}`
                    };

                    const setResults = await batchRequest(this.bxLink, batchCommands);
                    logMessage(
                        "info",
                        "bx/addDeal",
                        `Added ${products.length} product rows to deal ID ${dealId}`
                    );
                } else {
                    logMessage(
                        "warning",
                        "bx/addDeal",
                        `No valid products found for deal ID ${dealId}`
                    );
                }
            }

            logMessage("info", "bx/addDeal", `Created deal with ID ${dealId}`);
            return dealId;
        } catch (error) {
            logMessage("error", "bx/addDeal", error);
            throw error;
        }
    }
}