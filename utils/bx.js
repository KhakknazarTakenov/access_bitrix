import { Bitrix } from '@2bad/bitrix';
import {logMessage} from "../logger/logger.js";

export class BitrixUtils {
    constructor(bxLink) {
        this.bx = Bitrix(bxLink);
    }

    async getAllProductsFromSection(sectionId) {
        try {
            const allResults = [];
            let res;

            let start = 0;
            let total = 0;
            do {
                res = await this.bx.call("crm.product.list",
                    {
                        "select": ["ID", "NAME"],
                        "filter": { "SECTION_ID": "214" },
                        "start": start
                    }
                )

                total = res.total;
                start += 50;

                allResults.push(...res.result);
                if (res.total < 50) {
                    break;
                }
            } while(start < total)

            return allResults;
        } catch (error) {
            logMessage(LOG_TYPES.E, "utils/productsList.js 36", error);
            return [];
        }
    }

    async getAllProviders() {
        try {
            const allResults = [];
            let res;

            let start = 0;
            let total = 0;
            do {
                res = await this.bx.call("crm.contact.list",
                    {
                        "select": ["ID", "NAME", "LAST_NAME", "UF_CRM_1742725035196"],
                        "filter": { "UF_CRM_1742725035196": "1" },
                        "start": start
                    }
                )

                total = res.total;
                start += 50;

                allResults.push(...res.result);
                if (res.total < 50) {
                    break;
                }
            } while(start < total)

            return allResults;
        } catch (error) {
            logMessage(LOG_TYPES.E, "utils/productsList.js 36", error);
            return [];
        }
    }
}
