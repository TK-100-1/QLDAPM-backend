# Base image Node 18
FROM node:18-alpine

# Tạo thư mục app
WORKDIR /app

# Copy package.json
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Port của Express
EXPOSE 8080

# Start app
CMD ["node", "src/app.js"]