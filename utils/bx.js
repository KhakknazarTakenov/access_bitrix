// src/utils/bx.js
import { logMessage } from "../logger/logger.js";

// UF_CRM_1746032831962

export class BitrixUtils {
  constructor(bxLink) {
    this.bxLink = bxLink;
  }

  // Выполнение batch-запроса
  async batchRequest(commands) {
    try {
      if (
          !commands ||
          typeof commands !== "object" ||
          Object.keys(commands).length === 0
      ) {
        logMessage(
            "error",
            "bx/batchRequest",
            "Commands object is empty or invalid"
        );
        throw new Error("Commands object is empty or invalid");
      }

      logMessage(
          "info",
          "bx/batchRequest",
          `Sending batch request with commands: ${JSON.stringify(commands)}`
      );

      const response = await fetch(`${this.bxLink}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          halt: 0,
          cmd: commands,
        }),
      });

      if (!response.ok) {
        throw new Error(
            `Batch request failed with status ${response.status}: ${response.statusText}`
        );
      }

      const res = await response.json();
      logMessage(
          "info",
          "bx/batchRequest",
          `Batch response: ${JSON.stringify(res)}`
      );

      if (!res.result) {
        throw new Error(
            "Batch request response does not contain 'result' field"
        );
      }

      // Проверяем ошибки в result_error
      if (
          res.result.result_error &&
          Object.keys(res.result.result_error).length > 0
      ) {
        const errors = Object.entries(res.result.result_error)
            .map(
                ([cmd, err]) =>
                    `Command ${cmd} failed: ${
                        err.error_description || "Unknown error"
                    }`
            )
            .join("; ");
        throw new Error(`Batch request errors: ${errors}`);
      }

      // Обрабатываем результаты в зависимости от структуры ответа
      const results = Object.values(res.result.result)
          .map((item) => {
            // Для методов типа crm.item.add возвращается объект { item: {...} }
            if (item && item.item) {
              return item.item;
            }
            // Для списков (crm.product.list, crm.contact.list, crm.item.list) возвращается массив или объект
            return item;
          })
          .flat();

      results.forEach((item) => {
        if (
            item[process.env.UF_PRODUCT_ACCESS_ID] &&
            typeof item[process.env.UF_PRODUCT_ACCESS_ID] === "object"
        ) {
          item[process.env.UF_PRODUCT_ACCESS_ID] =
              item[process.env.UF_PRODUCT_ACCESS_ID].value ||
              item[process.env.UF_PRODUCT_ACCESS_ID][
                  Object.keys(item[process.env.UF_PRODUCT_ACCESS_ID])[0]
                  ];
        }
        if (
            item[process.env.UF_CONTACT_ACCESS_ID] &&
            typeof item[process.env.UF_CONTACT_ACCESS_ID] === "object"
        ) {
          item[process.env.UF_CONTACT_ACCESS_ID] =
              item[process.env.UF_CONTACT_ACCESS_ID].value ||
              item[process.env.UF_CONTACT_ACCESS_ID][
                  Object.keys(item[process.env.UF_CONTACT_ACCESS_ID])[0]
                  ];
        }
      });

      return results;
    } catch (error) {
      logMessage("error", "bx/batchRequest", error);
      throw error;
    }
  }

  // Создание сделки с использованием batch
  async createDeal(title, contactId, products, isChecked = false, deliveryDate = null) {
    try {
      const batchCommands = {
        create_deal: `crm.deal.add?fields[TITLE]=${encodeURIComponent(
            title
        )}&fields[CONTACT_ID]=${contactId}&fields[CATEGORY_ID]=12&fields[${process.env.BITRIX_PRICE_REQUEST_UF_ID}]=${isChecked ? "Y" : "N"}&fields[${process.env.BITRIX_DELIVERY_DATE_UF_ID}]=${deliveryDate}`,
      };

      const batchResults = await this.batchRequest(batchCommands);
      const dealId = batchResults[0];

      if (!dealId) {
        throw new Error("Failed to create deal in Bitrix24");
      }

      if (products && products.length > 0) {
        const rows = products
            .map(
                (product, index) =>
                    `rows[${index}][PRODUCT_ID]=${product.bitrix_id}&rows[${index}][QUANTITY]=${product.quantity}&rows[${index}][PRICE]=${product.price}&fields[ASSIGNED_BY_ID]=122`
            )
            .join("&");
        const productRowsCommand = {
          set_products: `crm.deal.productrows.set?id=${dealId}&${rows}`,
        };

        await this.batchRequest(productRowsCommand);
      }

      logMessage("info", "bx/createDeal", `Created deal with ID ${dealId}`);
      return dealId;
    } catch (error) {
      logMessage("error", "bx/createDeal", error);
      throw error;
    }
  }
}
