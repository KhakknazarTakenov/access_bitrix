// bx/products.js
import { logMessage } from "../../logger/logger.js";
import {batchRequest} from "./batchRequest.js";

export class ProductUtils {
    constructor(bxLink) {
        this.bxLink = bxLink;
    }

    // Получение товаров по Access ID (скоп crm)
    async getProductsByAccessIds(accessIds) {
        try {
            if (!accessIds || accessIds.length === 0) {
                logMessage(LOG_TYPES.I, "bx/getProductsByAccessIds", "No Access IDs provided");
                return [];
            }

            const batchSize = 50;
            const allResults = [];

            for (let i = 0; i < accessIds.length; i += batchSize) {
                const batchAccessIds = accessIds.slice(i, i + batchSize);
                const batchCommands = {};

                batchAccessIds.forEach((accessId, index) => {
                    batchCommands[
                        `product_${i + index}`
                        ] = `crm.product.list?select[]=ID&select[]=NAME&select[]=PRICE&select[]=MEASURE&select[]=${process.env.UF_PRODUCT_ACCESS_ID}&filter[${process.env.UF_PRODUCT_ACCESS_ID}]=${encodeURIComponent(accessId)}`;
                });

                const batchResults = await batchRequest(this.bxLink, batchCommands);
                allResults.push(...batchResults);
            }

            logMessage(LOG_TYPES.I, "bx/getProductsByAccessIds", `Fetched ${allResults.length} products`);
            return allResults;
        } catch (error) {
            logMessage(LOG_TYPES.E, "bx/getProductsByAccessIds", error);
            return [];
        }
    }

    // Получение каталогных товаров по их ID
    async getCatalogProducts(catalogProductIds) {
        try {
            if (!catalogProductIds || catalogProductIds.length === 0) {
                logMessage(LOG_TYPES.I, "bx/getCatalogProducts", "No Catalog Product IDs provided");
                return [];
            }

            const batchSize = 50;
            const allResults = [];

            for (let i = 0; i < catalogProductIds.length; i += batchSize) {
                const batchIds = catalogProductIds.slice(i, i + batchSize);
                const batchCommands = {};

                batchIds.forEach((productId, index) => {
                    batchCommands[
                        `catalog_product_${i + index}`
                        ] = `catalog.product.get?id=${productId}`;
                });

                const batchResults = await batchRequest(this.bxLink, batchCommands);
                allResults.push(...batchResults);
            }

            logMessage(LOG_TYPES.I, "bx/getCatalogProducts", `Fetched ${allResults.length} catalog products`);
            return allResults;
        } catch (error) {
            logMessage(LOG_TYPES.E, "bx/getCatalogProducts", error);
            return [];
        }
    }

    // Получение CRM товаров по их ID
    async getCrmProducts(crmProductIds) {
        try {
            if (!crmProductIds || crmProductIds.length === 0) {
                logMessage(LOG_TYPES.I, "bx/getCrmProducts", "No CRM Product IDs provided");
                return [];
            }

            const batchSize = 50;
            const allResults = [];
            for (let i = 0; i < crmProductIds.length; i += batchSize) {
                const batchIds = crmProductIds.slice(i, i + batchSize);
                const batchCommands = {};

                batchIds.forEach((productId, index) => {
                    batchCommands[
                        `crm_product_${i + index}`
                        ] = `crm.product.get?id=${productId}`;
                });
                const batchResults = await batchRequest(this.bxLink, batchCommands);
                allResults.push(...batchResults);
            }

            logMessage(LOG_TYPES.I, "bx/getCrmProducts", `Fetched ${allResults.length} CRM products`);

            return allResults;
        } catch (error) {
            logMessage(LOG_TYPES.E, "bx/getCrmProducts", error);
            return [];
        }
    }

    // Добавление товара (для raw и packaging_labels)
    async addProduct(fields) {
        try {
            const command = `crm.product.add?fields[NAME]=${encodeURIComponent(fields.NAME)}&fields[PRICE]=${fields.PRICE || 0}&fields[MEASURE]=${fields.MEASURE || 9}&fields[${process.env.UF_PRODUCT_ACCESS_ID}]=${fields[process.env.UF_PRODUCT_ACCESS_ID]}&fields[SECTION_ID]=${process.env.BITRIX_NEW_PRODUCT_SECTION_ID}`;
            const response = await batchRequest(this.bxLink, { add_product: command });
            const productId = response[0];

            if (!productId) {
                throw new Error("Failed to add product");
            }

            logMessage(LOG_TYPES.I, "bx/addProduct", `Added product with ID ${productId}`);
            return productId;
        } catch (error) {
            logMessage(LOG_TYPES.E, "bx/addProduct", error);
            throw error;
        }
    }

    // Обновление товара
    async updateProduct(id, fields) {
        try {
            const command = `crm.product.update?id=${id}&fields[NAME]=${encodeURIComponent(fields.NAME)}&fields[${process.env.UF_PRODUCT_ACCESS_ID}]=${fields[process.env.UF_PRODUCT_ACCESS_ID]}${fields["PRICE"] ? "&fields[PRICE]=" + fields["PRICE"] : ""}`;
            console.log(fields)
            console.log(command)
            const response = await batchRequest(this.bxLink, { update_product: command });
            const result = response[0];

            if (!result) {
                throw new Error(`Failed to update product with ID ${id}`);
            }

            logMessage(LOG_TYPES.I, "bx/updateProduct", `Updated product with ID ${id}`);
            return result;
        } catch (error) {
            logMessage(LOG_TYPES.E, "bx/updateProduct", error);
            throw error;
        }
    }
}