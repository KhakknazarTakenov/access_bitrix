# Use official Node.js LTS image
FROM node:20

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy the rest of the bot files
COPY . .

# Expose port 3492
EXPOSE 6734

# Run the bot
CMD ["node", "index.js"]
