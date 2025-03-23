import odbc from "odbc";

export async function getAccessProductsData() {
    try {
        const connectionString = `Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=./test.accdb;`;
        const connection = await odbc.connect(connectionString);

        const result = await connection.query('SELECT * FROM abfZutatenLager');

        await connection.close();

        return result;
    } catch (error) {
        console.error('Ошибка:', error.message);
    }
}

export async function getAccessProvidersData() {
    try {
        const connectionString = `Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ=./test.accdb;`;
        const connection = await odbc.connect(connectionString);

        const result = await connection.query('SELECT * FROM tblLieferant');

        await connection.close();

        return result;
    } catch (error) {
        console.error('Ошибка:', error.message);
    }
}