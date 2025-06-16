// dealService.js
import { logMessage } from "../logger/logger.js";
import { BitrixUtils } from "../utils/bx.js";
import { decryptText } from "../utils/crypto.js";

// Преобразование и проверка даты для Bitrix24
const parseDeliveryDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    logMessage("warn", "parseDeliveryDate", `Invalid date string: ${dateString}`);
    return null;
  }

  // Проверяем формат DD.MM.YYYY
  const dateParts = dateString.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!dateParts) {
    logMessage("warn", "parseDeliveryDate", `Incorrect date format: ${dateString}`);
    return null;
  }

  // Преобразуем в формат YYYY-MM-DD для Bitrix24
  const isoDate = `${dateParts[3]}-${dateParts[2]}-${dateParts[1]}`;
  const date = new Date(isoDate);

  if (isNaN(date.getTime())) {
    logMessage("error", "parseDeliveryDate", `Invalid date parsed from: ${isoDate}`);
    return null;
  }

  // Возвращаем строку в формате YYYY-MM-DD
  return isoDate;
};

// Логика разделения продуктов и создания сделок
export const createDeals = async (products) => {
  try {
    const bxLinkDecrypted = await decryptText(
        process.env.BX_LINK,
        process.env.CRYPTO_KEY,
        process.env.CRYPTO_IV
    );
    const bx = new BitrixUtils(bxLinkDecrypted);

    const supplierMap = new Map();

    // Группируем товары по поставщикам и значению isChecked
    for (const product of products) {
      for (const supplier of product.selectedSuppliers) {
        const supplierId = supplier.id;
        // Ключ для Map: комбинация supplierId и isChecked
        const key = `${supplierId}_${product.checked ? 'true' : 'false'}`;

        if (!supplierMap.has(key)) {
          supplierMap.set(key, {
            supplierId,
            name: supplier.name,
            products: [],
            isChecked: product.checked,
            delivery_date: !product.isDeliveryDateDisabled && product.deliveryDate && product.deliveryDate !== ""
                ? parseDeliveryDate(product.deliveryDate)
                : null,
          });
        }

        supplierMap.get(key).products.push(product);
      }
    }

    const deals = [];
    for (const [key, { supplierId, name, products, isChecked, delivery_date }] of supplierMap) {
      const title = `Сделка для ${name} ${isChecked ? '(Запрос цены)' : ''}`;
      const contactId = supplierId; // Предполагаем, что supplierId - это contactId
      const dealId = await bx.createDeal(title, contactId, products, isChecked, delivery_date);
      deals.push(dealId);
    }

    logMessage("info", "createDeals", `Created ${deals.length} deals`);
    return deals;
  } catch (error) {
    logMessage("error", "createDeals", error);
    throw error;
  }
};