// utils/suppliers.js
import { ContactUtils } from "./bx/contacts.js";
import { logMessage } from "../logger/logger.js";

// Обработка данных для типа "suppliers"
export const processSuppliers = async (records, bxLink) => {
    const bx = new ContactUtils(bxLink);

    // Обработка поставщиков
    const supplierIds = records
        .map((record) => record[process.env.ACCESS_SUPPLIER_ID_FIELD_KEY])
        .filter((id) => id != null);
    const uniqueSupplierIds = [...new Set(supplierIds)];

    const bitrixContacts = await bx.getContactsByAccessIds(uniqueSupplierIds);

    const processedData = [];
    for (const record of records) {
        const supplierId = record[process.env.ACCESS_SUPPLIER_ID_FIELD_KEY];
        const supplierName = record[process.env.ACCESS_SUPPLIER_NAME_FIELD_KEY] || "Unknown";

        let bitrixContact = bitrixContacts.find(
            (bc) => bc[process.env.UF_CONTACT_ACCESS_ID] == supplierId
        );

        let contactId;
        if (!bitrixContact) {
            // Создаём новый контакт
            contactId = await bx.addContact({
                NAME: supplierName,
                [process.env.UF_CONTACT_ACCESS_ID]: supplierId,
            });
            bitrixContact = {
                ID: contactId || 0,
                NAME: supplierName,
                [process.env.UF_CONTACT_ACCESS_ID]: supplierId,
            };
        } else {
            // // Проверяем, отличаются ли поля
            const hasDifferences =
                bitrixContact.NAME.toLowerCase().trim().replace(" ", "") != supplierName.toLowerCase().trim().replace(" ", "") ||
                bitrixContact[process.env.UF_CONTACT_ACCESS_ID] != supplierId;

            if (hasDifferences) {
                // Обновляем контакт
                await bx.updateContact(bitrixContact.ID, {
                    NAME: supplierName,
                    [process.env.UF_CONTACT_ACCESS_ID]: supplierId,
                });
            }
            contactId = bitrixContact.ID;
        }

        processedData.push({
            bitrix_id: contactId,
            supplier_id: supplierId,
            name: supplierName,
        });
    }

    return processedData;
};