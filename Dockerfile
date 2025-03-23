# Используем node:slim (основан на Debian)
FROM node:slim

# Устанавливаем переменную окружения
ENV NODE_ENV development

# Устанавливаем рабочую директорию
WORKDIR /express-docker

# Копируем package.json и package-lock.json для установки зависимостей
COPY package*.json ./

# Устанавливаем зависимости проекта и необходимые пакеты
RUN apt-get update && apt-get install -y \
    nano \
    unixodbc \
    unixodbc-dev \
    libodbc1 \
    odbcinst \
    mdbtools \
    && rm -rf /var/lib/apt/lists/* \
    && npm install

# Копируем конфигурационные файлы ODBC
COPY odbcinst.ini /etc/odbcinst.ini
COPY odbc.ini /etc/odbc.ini

# Копируем остальные файлы проекта
COPY . .

# Копируем .accdb файл (если он есть в проекте)
# Если ты монтируешь файл через том, закомментируй эту строку
COPY your_database.accdb /express-docker/your_database.accdb

# Указываем порт
EXPOSE 6734

# Запускаем приложение
CMD ["node", "index.js"]