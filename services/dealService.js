// src/services/dealService.js
import { logMessage } from "../logger/logger.js";
import { BitrixUtils } from "../utils/bx.js";
import { decryptText } from "../utils/crypto.js";

// Логика разделения продуктов и создания сделок
export const createDeals = async (products) => {
  console.log("products", products);

  try {
    const bxLinkDecrypted = await decryptText(
      process.env.BX_LINK,
      process.env.CRYPTO_KEY,
      process.env.CRYPTO_IV
    );
    const bx = new BitrixUtils(bxLinkDecrypted);

    const supplierMap = new Map();

    for (const product of products) {
      for (const supplier of product.selectedSuppliers) {
        const supplierId = supplier.id;
        if (!supplierMap.has(supplierId)) {
          supplierMap.set(supplierId, {
            name: supplier.name,
            products: [],
          });
        }
        supplierMap.get(supplierId).products.push(product);
      }
    }

    const deals = [];
    for (const [supplierId, { name, products }] of supplierMap) {
      const title = `Deal for ${name}`;
      const contactId = supplierId; // Предполагаем, что supplierId - это contactId
      const dealId = await bx.createDeal(title, contactId, products);
      deals.push(dealId);
    }

    logMessage("info", "createDeals", `Created ${deals.length} deals`);
    return deals;
  } catch (error) {
    logMessage("error", "createDeals", error);
    throw error;
  }
};
