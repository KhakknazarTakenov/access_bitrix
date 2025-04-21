// src/utils/bx.js
import { logMessage } from "../logger/logger.js";

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

  // Получение продуктов по списку Access ID через batch
  async getProductsByAccessIds(accessIds) {
    try {
      if (!accessIds || accessIds.length === 0) {
        logMessage(
          "info",
          "bx/getProductsByAccessIds",
          "No Access IDs provided"
        );
        return [];
      }

      const allResults = [];
      const batchSize = 50;

      for (let i = 0; i < accessIds.length; i += batchSize) {
        const batchIds = accessIds.slice(i, i + batchSize);
        const batchCommands = {};

        batchIds.forEach((accessId, index) => {
          const accessIdStr = String(accessId);
          batchCommands[
            `product_${i + index}`
          ] = `crm.product.list?select[]=ID&select[]=NAME&select[]=PRICE&select[]=MEASURE&select[]=${process.env.UF_PRODUCT_ACCESS_ID}&filter[${process.env.UF_PRODUCT_ACCESS_ID}]=${accessIdStr}`;
        });

        const batchResults = await this.batchRequest(batchCommands);

        allResults.push(...batchResults);
      }

      logMessage(
        "info",
        "bx/getProductsByAccessIds",
        `Fetched ${allResults.length} products`
      );

      return allResults;
    } catch (error) {
      logMessage("error", "bx/getProductsByAccessIds", error);
      return [];
    }
  }

  // Получение контактов по списку Access ID через batch
  async getContactsByAccessIds(accessIds) {
    try {
      if (!accessIds || accessIds.length === 0) {
        logMessage(
          "info",
          "bx/getContactsByAccessIds",
          "No Access IDs provided"
        );
        return [];
      }

      const allResults = [];
      const batchSize = 50;

      for (let i = 0; i < accessIds.length; i += batchSize) {
        const batchIds = accessIds.slice(i, i + batchSize);
        const batchCommands = {};

        batchIds.forEach((accessId, index) => {
          const accessIdStr = String(accessId);
          batchCommands[
            `contact_${i + index}`
          ] = `crm.contact.list?select[]=ID&select[]=NAME&select[]=${process.env.UF_CONTACT_ACCESS_ID}&filter[${process.env.UF_CONTACT_ACCESS_ID}]=${accessIdStr}`;
        });

        const batchResults = await this.batchRequest(batchCommands);
        allResults.push(...batchResults);
      }

      logMessage(
        "info",
        "bx/getContactsByAccessIds",
        `Fetched ${allResults.length} contacts`
      );
      return allResults;
    } catch (error) {
      logMessage("error", "bx/getContactsByAccessIds", error);
      return [];
    }
  }
  async getContactsWithAccessId() {
    const allContacts = [];
    let start = 0;

    try {
      while (true) {
        const response = await fetch(`${this.bxLink}crm.contact.list`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            select: ["ID", "NAME", "UF_CRM_1744893791481"],
            filter: { "!=UF_CRM_1744893791481": "" },
            start,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(`API error: ${data.error}`);
        }

        const contacts = data.result || [];
        allContacts.push(...contacts);

        if (!("next" in data)) break; // Все загружено
        start = data.next;
      }

      logMessage(
        "info",
        "bx/getContactsWithAccessId",
        `Total contacts fetched: ${allContacts.length}`
      );

      return allContacts; // 👈 тут возвращаем весь массив фронту
    } catch (error) {
      logMessage("error", "bx/getContactsWithAccessId", error);
      return [];
    }
  }

  // Обновление продукта в Bitrix24
  async updateProduct(id, fields) {
    try {
      const command = `crm.product.update?id=${id}&fields[NAME]=${encodeURIComponent(
        fields.NAME
      )}&fields[PRICE]=${fields.PRICE}&fields[MEASURE]=${
        fields.MEASURE
      }&fields[${process.env.UF_PRODUCT_ACCESS_ID}]=${encodeURIComponent(
        fields[process.env.UF_PRODUCT_ACCESS_ID]
      )}`;

      const batchCommands = {
        update_product: command,
      };
      console.log("batchCommands", batchCommands);
      const batchResults = await this.batchRequest(batchCommands);
      const result = batchResults[0];

      if (!result) {
        throw new Error(`Failed to update product with ID ${id}`);
      }

      logMessage("info", "bx/updateProduct", `Updated product with ID ${id}`);
      return result;
    } catch (error) {
      logMessage("error", "bx/updateProduct", error);
      throw error;
    }
  }
  async updateProductRow(id, fields) {
    try {
      const command = `crm.product.update?id=${id}&fields[NAME]=${encodeURIComponent(
        fields.NAME
      )}&fields[${process.env.UF_PRODUCT_ACCESS_ID}]=${encodeURIComponent(
        fields[process.env.UF_PRODUCT_ACCESS_ID]
      )}`;
      const batchCommands = {
        update_product: command,
      };

      const batchResults = await this.batchRequest(batchCommands);
      const result = batchResults[0];

      if (!result) {
        throw new Error(`Failed to update product with ID ${id}`);
      }

      logMessage("info", "bx/updateProduct", `Updated product with ID ${id}`);
      return result;
    } catch (error) {
      logMessage("error", "bx/updateProduct", error);
      throw error;
    }
  }
  // Создание нового продукта в Bitrix24
  async addProduct(fields) {
    console.log("fields", fields);
    try {
      const command = `crm.product.add?fields[NAME]=${encodeURIComponent(
        fields.NAME
      )}&fields[PRICE]=${fields.PRICE}&fields[MEASURE]=${
        fields.MEASURE
      }&fields[${process.env.UF_PRODUCT_ACCESS_ID}]=${encodeURIComponent(
        fields[process.env.UF_PRODUCT_ACCESS_ID]
      )}&fields[SECTION_ID]=${process.env.BITRIX_NEW_PRODUCT_SECTION_ID}`;
      const batchCommands = {
        add_product: command,
      };

      const batchResults = await this.batchRequest(batchCommands);
      const productId = batchResults[0];

      if (!productId) {
        throw new Error("Failed to create product");
      }
      logMessage(
        "info",
        "bx/addProduct",
        `Created product with ID ${productId}`
      );
      return productId;
    } catch (error) {
      logMessage("error", "bx/addProduct", error);
      throw error;
    }
  }
  async addProductRaw(fields) {
    try {
      const command = `crm.product.add?fields[NAME]=${encodeURIComponent(
        fields.NAME
      )}&fields[${process.env.UF_PRODUCT_ACCESS_ID}]=${encodeURIComponent(
        fields[process.env.UF_PRODUCT_ACCESS_ID]
      )}&fields[SECTION_ID]=${process.env.BITRIX_NEW_PRODUCT_SECTION_ID}`;
      const batchCommands = {
        add_product: command,
      };

      const batchResults = await this.batchRequest(batchCommands);
      const productId = batchResults[0];
      console.log(batchResults, "batchResults");

      if (!productId) {
        throw new Error("Failed to create product");
      }
      logMessage(
        "info",
        "bx/addProduct",
        `Created product with ID ${productId}`
      );
      return productId;
    } catch (error) {
      logMessage("error", "bx/addProduct", error);
      throw error;
    }
  }
  // Создание нового контакта в Bitrix24
  async addContact(fields) {
    try {
      const command = `crm.contact.add?fields[NAME]=${encodeURIComponent(
        fields.NAME
      )}&fields[${process.env.UF_CONTACT_ACCESS_ID}]=${encodeURIComponent(
        fields[process.env.UF_CONTACT_ACCESS_ID]
      )}`;
      const batchCommands = {
        add_contact: command,
      };

      const batchResults = await this.batchRequest(batchCommands);
      const contactId = batchResults[0];

      if (!contactId) {
        throw new Error("Failed to create contact");
      }

      logMessage(
        "info",
        "bx/addContact",
        `Created contact with ID ${contactId}`
      );
      return contactId;
    } catch (error) {
      logMessage("error", "bx/addContact", error);
      throw error;
    }
  }

  // Обновление контакта в Bitrix24
  async updateContact(id, fields) {
    try {
      const command = `crm.contact.update?id=${id}&fields[NAME]=${encodeURIComponent(
        fields.NAME
      )}&fields[${process.env.UF_CONTACT_ACCESS_ID}]=${encodeURIComponent(
        fields[process.env.UF_CONTACT_ACCESS_ID]
      )}`;
      const batchCommands = {
        update_contact: command,
      };

      const batchResults = await this.batchRequest(batchCommands);
      const result = batchResults[0];

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

  // Получение сделок смарт-процесса по списку Contact ID через batch
  async getSmartProcessDealsByContactIds(entityTypeId, contactIds) {
    try {
      if (!contactIds || contactIds.length === 0) {
        logMessage(
          "info",
          "bx/getSmartProcessDealsByContactIds",
          "No Contact IDs provided"
        );
        return [];
      }

      const allResults = [];
      const batchSize = 50;

      for (let i = 0; i < contactIds.length; i += batchSize) {
        const batchIds = contactIds.slice(i, i + batchSize);
        const batchCommands = {};

        batchIds.forEach((contactId, index) => {
          batchCommands[
            `deal_${i + index}`
          ] = `crm.item.list?entityTypeId=${entityTypeId}&filter[contactId]=${contactId}`;
        });

        const batchResults = await this.batchRequest(batchCommands);

        allResults.push(
          ...batchResults.flatMap((item) => {
            // Извлекаем массив items напрямую из item.items
            return (item.items || []).map((deal) => ({
              ...deal,
              productRows: item.productRows || [],
            }));
          })
        );
      }

      logMessage(
        "info",
        "bx/getSmartProcessDealsByContactIds",
        `Fetched ${allResults.length} smart process deals`
      );
      return allResults;
    } catch (error) {
      logMessage("error", "bx/getSmartProcessDealsByContactIds", error);
      return [];
    }
  }
  async getSmartProcessDealsByContactIdsWithProducts(entityTypeId, contactIds) {
    try {
      // Проверяем, переданы ли contactIds
      if (!contactIds || contactIds.length === 0) {
        logMessage(
          "info",
          "bx/getSmartProcessDealsByContactIdsWithProducts",
          "No Contact IDs provided"
        );
        return [];
      }

      // Собираем все сделки
      const allDeals = [];
      const batchSize = 50;

      for (let i = 0; i < contactIds.length; i += batchSize) {
        const batchIds = contactIds.slice(i, i + batchSize);
        const batchCommands = {};

        // Формируем команды для получения сделок по контактам
        batchIds.forEach((contactId, index) => {
          batchCommands[
            `deal_${i + index}`
          ] = `crm.item.list?entityTypeId=${entityTypeId}&filter[contactId]=${contactId}`;
        });

        // Выполняем пакетный запрос
        const batchResults = await this.batchRequest(batchCommands);
        // if (Array.isArray(batchResults)) {
        //   // Итерируем по каждому элементу массива
        //   batchResults.forEach((deal, index) => {
        //     console.log(`Deal #${index + 1}:`);
        //     console.log(JSON.stringify(deal, null, 2)); // Красивый вывод с отступами
        //     console.log("---"); // Разделитель между сделками
        //   });
        // } else {
        //   console.log("existingDeals не является массивом:", existingDeals);
        // }

        // Собираем сделки из результатов

        batchResults.forEach((result) => {
          // console.log(result, "allDeals.length", batchResults.length);

          if (
            result.items &&
            Array.isArray(result.items) &&
            result.items.length > 0
          ) {
            allDeals.push(...result.items);
          }
        });
      }

      // Создаем карту для быстрого доступа к сделкам по ID
      const dealMap = new Map(allDeals.map((deal) => [deal.id, deal]));

      for (const deal of allDeals) {
        try {
          const response = await fetch(
            `${this.bxLink}crm.item.productrow.list`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                filter: {
                  "=ownerType": "T42C",
                  "=ownerId": deal.id,
                },
              }),
            }
          );

          const data = await response.json();

          if (!response.ok || data.error) {
            throw new Error(
              `Failed to fetch product rows for deal ${deal.id}: ${
                data.error_description || data.error
              }`
            );
          }

          deal.productRows = data.result.productRows || [];
        } catch (err) {
          deal.productRows = []; // если ошибка — пустой массив
          logMessage(
            "error",
            "bx/getSmartProcessDealsByContactIdsWithProducts",
            `Ошибка при получении productRows для сделки ${deal.id}: ${err.message}`
          );
        }
      }

      logMessage(
        "info",
        "bx/getSmartProcessDealsByContactIdsWithProducts",
        `Загрузили продукты для ${allDeals.length} сделок`
      );

      return allDeals;
    } catch (error) {
      // Обрабатываем общие ошибки
      logMessage(
        "error",
        "bx/getSmartProcessDealsByContactIdsWithProducts",
        error
      );
      return [];
    }
  }
  // Вспомогательный метод для получения товаров из каталога или их создание
  async getCatalogProducts(crmProducts) {
    try {
      const crmProductIds = crmProducts
        .map((p) => p.CRM_PRODUCT_ID)
        .filter((id) => id);
      const iblockId = process.env.BITRIX_IBLOCK_ID || "16"; // По умолчанию 16
      const batchCommands = {};

      // Формируем запросы для поиска товаров по parentId
      crmProductIds.forEach((crmProductId, index) => {
        batchCommands[
          `product_${index}`
        ] = `catalog.product.list?select[]=id&select[]=iblockId&select[]=name&select[]=xmlId&select[]=parentId&filter[iblockId]=${iblockId}&filter[parentId]=${encodeURIComponent(
          crmProductId
        )}`;
      });

      const batchResults = await this.batchRequest(batchCommands);
      // Извлекаем товары из объекта products
      const catalogProducts = Object.values(batchResults)
        .flatMap((result) => result.products || [])
        .filter((p) => p.id && crmProductIds.includes(p.parentId?.value));

      // Если не все товары найдены, создаём недостающие
      if (catalogProducts.length < crmProductIds.length) {
        const foundCrmProductIds = catalogProducts.map(
          (p) => p.parentId?.value
        );
        const missingProducts = crmProducts.filter(
          (p) => !foundCrmProductIds.includes(p.CRM_PRODUCT_ID)
        );
        const createCommands = {};

        missingProducts.forEach((product, index) => {
          createCommands[
            `create_product_${index}`
          ] = `catalog.product.add?fields[iblockId]=${iblockId}&fields[name]=${encodeURIComponent(
            product.NAME
          )}&fields[parentId]=${product.CRM_PRODUCT_ID}&fields[price]=${
            product.PRICE
          }&fields[measure]=${product.MEASURE_CODE}`;
        });

        const createResults = await this.batchRequest(createCommands);
        const newCatalogProducts = Object.values(createResults).map(
          (result, index) => {
            const product = missingProducts[index];
            return {
              id: result, // ID нового товара в каталоге
              iblockId,
              name: product.NAME,
              parentId: { value: product.CRM_PRODUCT_ID },
            };
          }
        );

        catalogProducts.push(...newCatalogProducts);
      }

      logMessage(
        "info",
        "bx/getCatalogProducts",
        `Fetched or created ${
          catalogProducts.length
        } catalog products for CRM product IDs: ${JSON.stringify(
          crmProductIds
        )}`
      );
      return catalogProducts;
    } catch (error) {
      logMessage("error", "bx/getCatalogProducts", error);
      return [];
    }
  }

  // Получение товаров сделки в смарт-процессе
  async getSmartProcessDealProducts(entityTypeId, dealId) {
    try {
      const response = await fetch(`${this.bxLink}/crm.item.productrow.list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filter: {
            "=ownerType": "T42C", // формат типа владельца для смарт-процессов
            "=ownerId": dealId,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to get deal products with status ${response.status}: ${response.statusText}`
        );
      }

      const productsData = await response.json();
      logMessage(
        "info",
        "bx/getSmartProcessDealProducts",
        `Products list response: ${JSON.stringify(productsData)}`
      );

      if (!productsData.result || !productsData.result.productRows) {
        return [];
      }

      return productsData.result.productRows;
    } catch (error) {
      logMessage("error", "bx/getSmartProcessDealProducts", error);
      return [];
    }
  }

  // Создание сделки в смарт-процессе
  async addSmartProcessDeal(entityTypeId, fields, products) {
    try {
      // Создаём сделку без товаров
      const response = await fetch(`${this.bxLink}/crm.item.add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityTypeId: entityTypeId.toString(),
          fields: {
            TITLE: fields.TITLE,
            CONTACT_ID: fields.CONTACT_ID,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to create deal with status ${response.status}: ${response.statusText}`
        );
      }

      const dealData = await response.json();
      logMessage(
        "info",
        "bx/addSmartProcessDeal",
        `Deal creation response: ${JSON.stringify(dealData)}`
      );

      if (
        !dealData.result ||
        !dealData.result.item ||
        !dealData.result.item.id
      ) {
        throw new Error(
          "Failed to create smart process deal: Invalid response format"
        );
      }

      const dealId = dealData.result.item.id;

      // Добавляем товары по одному через crm.item.productrow.add
      if (products && products.length > 0) {
        // Получаем товары из каталога
        const catalogProducts = await this.getCatalogProducts(products);
        const batchCommands = {};
        // Добавляем товары по одному
        // for (const product of products) {
        //   try {
        //     const catalogProduct = catalogProducts.find(
        //       (cp) => cp.parentId?.value === product.CRM_PRODUCT_ID
        //     );

        //     if (!catalogProduct) {
        //       logMessage(
        //         "warning",
        //         "bx/addSmartProcessDeal",
        //         `Catalog product not found for CRM product ${product.NAME} (CRM_PRODUCT_ID: ${product.CRM_PRODUCT_ID})`
        //       );
        //       continue;
        //     }

        //     // Используем правильный метод API и формат данных
        //     const productRowData = {
        //       fields: {
        //         ownerType: "T42C", // правильный формат типа владельца для смарт-процессов
        //         ownerId: dealId,
        //         productId: catalogProduct.id, // используем ID каталога, а не фиксированное значение
        //         price: product.PRICE || 0,
        //         quantity: product.QUANTITY || 1,
        //       },
        //     };

        //     logMessage(
        //       "info",
        //       "bx/addSmartProcessDeal",
        //       `Adding product ${
        //         catalogProduct.id
        //       } to deal ${dealId}, data: ${JSON.stringify(productRowData)}`
        //     );

        //     const productResponse = await fetch(
        //       `${this.bxLink}/crm.item.productrow.add`,
        //       {
        //         method: "POST",
        //         headers: { "Content-Type": "application/json" },
        //         body: JSON.stringify(productRowData),
        //       }
        //     );

        //     const productResult = await productResponse.json();
        //     logMessage(
        //       "info",
        //       "bx/addSmartProcessDeal",
        //       `Product addition result: ${JSON.stringify(productResult)}`
        //     );
        //   } catch (productError) {
        //     logMessage(
        //       "error",
        //       "bx/addSmartProcessDeal",
        //       `Failed to add product: ${productError.message}`
        //     );
        //   }
        // }
        const batchSize = 10;

        for (let i = 0; i < products.length; i += batchSize) {
          const chunk = products.slice(i, i + batchSize);
          const batchCommands = {};

          chunk.forEach((product, idx) => {
            const catalogProduct = catalogProducts.find(
              (cp) => cp.parentId?.value === product.CRM_PRODUCT_ID
            );

            if (!catalogProduct) {
              logMessage(
                "warning",
                "bx/addSmartProcessDeal",
                `Catalog product not found for CRM product ${product.NAME} (CRM_PRODUCT_ID: ${product.CRM_PRODUCT_ID})`
              );
              return;
            }

            batchCommands[
              `add_product_${i + idx}`
            ] = `crm.item.productrow.add?fields[ownerType]=T42C&fields[ownerId]=${dealId}&fields[productId]=${
              catalogProduct.id
            }&fields[price]=${product.PRICE || 0}&fields[quantity]=${
              product.QUANTITY || 1
            }`;
          });

          // Отправляем один батч
          const batchResults = await this.batchRequest(batchCommands);
          logMessage(
            "info",
            "bx/addSmartProcessDeal",
            `Added ${
              Object.keys(batchResults).length
            } products to deal ${dealId} (batch ${i / batchSize + 1})`
          );

          // Пауза между batch'ами — на всякий случай
          await new Promise((res) => setTimeout(res, 300));
        }
      }

      logMessage(
        "info",
        "bx/addSmartProcessDeal",
        `Created smart process deal with ID ${dealId} in entityTypeId ${entityTypeId}`
      );
      return dealId;
    } catch (error) {
      logMessage("error", "bx/addSmartProcessDeal", error);
      throw error;
    }
  }

  // Обновление сделки в смарт-процессе
  async updateSmartProcessDeal(entityTypeId, id, fields, products) {
    try {
      // Обновляем поля сделки
      const response = await fetch(`${this.bxLink}/crm.item.update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityTypeId: entityTypeId.toString(),
          id: id,
          fields: {
            TITLE: fields.TITLE,
            CONTACT_ID: fields.CONTACT_ID,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Не удалось обновить сделку, статус ${response.status}: ${response.statusText}`
        );
      }

      const updateData = await response.json();

      if (!updateData.result) {
        throw new Error(`Не удалось обновить сделку смарт-процесса с ID ${id}`);
      }

      // Обрабатываем товары, если они переданы
      if (products && products.length > 0) {
        // Получаем текущие товары сделки
        let currentProducts = await this.getSmartProcessDealProducts(
          entityTypeId,
          id
        );

        // Получаем товары из каталога
        const catalogProducts = await this.getCatalogProducts(products);

        // Создаем набор новых ID товаров для проверки дубликатов
        const newProductIds = new Set(
          products.map((p) => p.CRM_PRODUCT_ID).filter((id) => id)
        );

        // // Удаляем товары, которых нет в новом списке
        for (const currentProduct of currentProducts) {
          const catalogProduct = catalogProducts.find(
            (cp) => cp.id === currentProduct.productId
          );

          const shouldRemove =
            !catalogProduct ||
            !newProductIds.has(catalogProduct.parentId?.value);

          if (shouldRemove) {
            try {
              logMessage(
                "info",
                "bx/updateSmartProcessDeal",
                `Удаление товара с ID ${currentProduct.id} из сделки ${id}`
              );
              const deleteResponse = await fetch(
                `${this.bxLink}/crm.item.productrow.delete`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: currentProduct.id }),
                }
              );

              if (!deleteResponse.ok) {
                logMessage(
                  "warning",
                  "bx/updateSmartProcessDeal",
                  `Не удалось удалить товар с ID ${currentProduct.id}: ${deleteResponse.statusText}`
                );
              }
            } catch (deleteError) {
              logMessage(
                "error",
                "bx/updateSmartProcessDeal",
                `Ошибка удаления товара: ${deleteError.message}`
              );
            }
          }
        }

        // // Добавляем или обновляем товары
        for (const product of products) {
          try {
            const catalogProduct = catalogProducts.find(
              (cp) => cp.parentId?.value === product.CRM_PRODUCT_ID
            );

            if (!catalogProduct) {
              logMessage(
                "warning",
                "bx/updateSmartProcessDeal",
                `Товар каталога не найден для CRM товара ${product.NAME} (CRM_PRODUCT_ID: ${product.CRM_PRODUCT_ID})`
              );
              continue;
            }

            // Проверяем, существует ли товар в сделке
            const existingProduct = currentProducts.find(
              (cp) => cp.productId === catalogProduct.id
            );

            if (existingProduct) {
              // Обновляем существующий товар, если изменились количество или цена
            } else {
              // Добавляем новый товар
              const productRowData = {
                fields: {
                  ownerType: "T42C",
                  ownerId: id,
                  productId: catalogProduct.id,
                  price: product.PRICE || 0,
                  quantity: product.QUANTITY || 1,
                },
              };

              logMessage(
                "info",
                "bx/updateSmartProcessDeal",
                `Добавление товара ${
                  catalogProduct.id
                } в сделку ${id}, данные: ${JSON.stringify(productRowData)}`
              );

              const productResponse = await fetch(
                `${this.bxLink}/crm.item.productrow.add`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(productRowData),
                }
              );

              const productResult = await productResponse.json();
              logMessage(
                "info",
                "bx/updateSmartProcessDeal",
                `Результат добавления товара: ${JSON.stringify(productResult)}`
              );
            }
          } catch (productError) {
            logMessage(
              "error",
              "bx/updateSmartProcessDeal",
              `Не удалось обработать товар: ${productError.message}`
            );
          }
        }
      }

      logMessage(
        "info",
        "bx/updateSmartProcessDeal",
        `Обновлена сделка смарт-процесса с ID ${id} в entityTypeId ${entityTypeId}`
      );
      return id;
    } catch (error) {
      logMessage("error", "bx/updateSmartProcessDeal", error);
      throw error;
    }
  }

  // Создание сделки с использованием batch
  async createDeal(title, contactId, products) {
    try {
      const batchCommands = {
        create_deal: `crm.deal.add?fields[TITLE]=${encodeURIComponent(
          title
        )}&fields[CONTACT_ID]=${contactId}&fields[CATEGORY_ID]=12`,
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
              `rows[${index}][PRODUCT_ID]=${product.bitrix_id}&rows[${index}][QUANTITY]=${product.quantity}&fields[ASSIGNED_BY_ID]=122`
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
