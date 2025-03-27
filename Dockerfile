# Используем node:slim (основан на Debian)
FROM node:slim

# Устанавливаем переменную окружения
ENV NODE_ENV development

# Устанавливаем рабочую директорию
WORKDIR /express-docker

# Копируем package.json и package-lock.json для установки зависимостей
COPY package*.json ./

# Устанавливаем зависимости для сборки mdbtools
RUN apt-get update && apt-get install -y \
    nano \
    unixodbc \
    unixodbc-dev \
    libodbc1 \
    odbcinst \
    build-essential \
    autoconf \
    automake \
    libtool \
    libglib2.0-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Скачиваем и собираем mdbtools с поддержкой ODBC
RUN wget https://github.com/mdbtools/mdbtools/archive/refs/tags/v1.0.0.tar.gz \
    && tar -xzf v1.0.0.tar.gz \
    && cd mdbtools-1.0.0 \
    && autoreconf -i -f \
    && ./configure --with-unixodbc=/usr \
    && make \
    && make install \
    && cd .. \
    && rm -rf mdbtools-1.0.0 v1.0.0.tar.gz

# Устанавливаем зависимости проекта
RUN npm install

# Копируем конфигурационные файлы ODBC
COPY odbcinst.ini /etc/odbcinst.ini
COPY odbc.ini /etc/odbc.ini

# Копируем остальные файлы проекта
COPY . .

# Копируем .accdb файл
COPY test.accdb /express-docker/test.accdb

# Указываем порт
EXPOSE 6734

# Запускаем приложение
CMD ["node", "index.js"]