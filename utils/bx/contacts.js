// bx/contacts.js
import { logMessage } from "../../logger/logger.js";
import { ProductUtils } from "./products.js";
import { batchRequest } from "./batchRequest.js";

export class ContactUtils {
    constructor(bxLink) {
        this.bxLink = bxLink;
        this.productUtils = new ProductUtils(bxLink);
    }

    // Получение контактов по Access ID
    async getContactsByAccessIds(accessIds) {
        try {
            if (!accessIds || accessIds.length === 0) {
                logMessage("info", "bx/getContactsByAccessIds", "No Access IDs provided");
                return [];
            }

            const batchSize = 50;
            const allResults = [];

            for (let i = 0; i < accessIds.length; i += batchSize) {
                const batchAccessIds = accessIds.slice(i, i + batchSize);
                const batchCommands = {};

                batchAccessIds.forEach((accessId, index) => {
                    batchCommands[
                        `contact_${i + index}`
                        ] = `crm.contact.list?select[]=ID&select[]=NAME&select[]=${process.env.UF_CONTACT_PRODUCT_IDS_FIELD}&select[]=${process.env.UF_CONTACT_ACCESS_ID}&filter[${process.env.UF_CONTACT_ACCESS_ID}]=${encodeURIComponent(accessId)}`;
                });

                const batchResults = await batchRequest(this.bxLink, batchCommands);
                allResults.push(...batchResults);
            }

            logMessage("info", "bx/getContactsByAccessIds", `Fetched ${allResults.length} contacts`);
            return allResults;
        } catch (error) {
            logMessage("error", "bx/getContactsByAccessIds", error);
            return [];
        }
    }

    // Получение товаров поставщика (контакта) по его ID
    async getSupplierProducts(contactIds) {
        try {
            const supplierProductsMap = new Map();

            // Если передан один ID, преобразуем его в массив
            const ids = Array.isArray(contactIds) ? contactIds : [contactIds];
            if (ids.length === 0) {
                logMessage("info", "bx/getSupplierProducts", "No contact IDs provided");
                return supplierProductsMap;
            }

            const batchSize = 50;
            for (let i = 0; i < ids.length; i += batchSize) {
                const batchIds = ids.slice(i, i + batchSize);
                const batchCommands = {};

                // Формируем команды для получения контактов с их товарами
                batchIds.forEach((id, index) => {
                    batchCommands[`contact_${id}`] = `crm.contact.get?id=${id}&select[]=${process.env.UF_CONTACT_PRODUCT_IDS_FIELD}`;
                });

                const batchResults = await batchRequest(this.bxLink, batchCommands);

                // Обрабатываем результаты
                batchResults.forEach((contact, index) => {
                    const contactId = batchIds[index];
                    if (!contact) {
                        logMessage(
                            LOG_TYPES.W,
                            "bx/getSupplierProducts",
                            `Contact with ID ${contactId} not found`
                        );
                        supplierProductsMap.set(contactId, []);
                        return;
                    }

                    // Извлекаем ID товаров из поля UF_CRM_1746032831962
                    const productIds = contact[process.env.UF_CONTACT_PRODUCT_IDS_FIELD] || [];
                    const allProductIds = new Set();

                    if (Array.isArray(productIds)) {
                        productIds.forEach(id => allProductIds.add(Number(id)));
                    } else if (typeof productIds === 'number') {
                        allProductIds.add(Number(productIds));
                    }

                    supplierProductsMap.set(contactId, Array.from(allProductIds));
                });
            }

            logMessage(
                LOG_TYPES.I,
                "bx/getSupplierProducts",
                `Fetched product IDs for ${supplierProductsMap.size} contacts`
            );

            return supplierProductsMap;
        } catch (error) {
            logMessage(LOG_TYPES.E, "bx/getSupplierProducts", error);
            return new Map();
        }
    }

    // Добавление контакта
    async addContact(fields) {
        try {
            const command = `crm.contact.add?fields[NAME]=${encodeURIComponent(fields.NAME)}&fields[${process.env.UF_CONTACT_ACCESS_ID}]=${fields[process.env.UF_CONTACT_ACCESS_ID]}`;
            const response = await batchRequest(this.bxLink,{ add_contact: command });
            const contactId = response[0];

            if (!contactId) {
                throw new Error("Failed to add contact");
            }

            logMessage("info", "bx/addContact", `Added contact with ID ${contactId}`);
            return contactId;
        } catch (error) {
            logMessage("error", "bx/addContact", error);
            throw error;
        }
    }

    // Обновление контакта
    async updateContact(id, fields) {
        try {
            // Формируем базовую команду для обновления контакта
            let command = `crm.contact.update?id=${id}&fields[NAME]=${encodeURIComponent(fields.NAME)}&fields[${process.env.UF_CONTACT_ACCESS_ID}]=${fields[process.env.UF_CONTACT_ACCESS_ID]}`;

            // Если передано поле UF_CRM_1746032831962, добавляем его в запрос
            if (fields[process.env.UF_CONTACT_PRODUCT_IDS_FIELD]) {
                const productIds = Array.isArray(fields[process.env.UF_CONTACT_PRODUCT_IDS_FIELD])
                    ? fields[process.env.UF_CONTACT_PRODUCT_IDS_FIELD]
                    : [];
                // Передаём каждое значение массива как отдельный параметр с индексом
                productIds.forEach((id, index) => {
                    command += `&fields[${process.env.UF_CONTACT_PRODUCT_IDS_FIELD}][${index}]=${id}`;
                });
            }

            logMessage("info", "bx/updateContact", `Updating contact with ID ${id}: ${command}`);

            const response = await batchRequest(this.bxLink, { update_contact: command });
            const result = response[0];

            if (!result) {
                throw new Error(`Failed to update contact with ID ${id}`);
            }

            logMessage("info", "bx/updateContact", `Updated contact with ID ${id}`);
            return result;
        } catch (error) {
            logMessage("error", "bx/updateContact", error);
            throw error;
        }
    }
}