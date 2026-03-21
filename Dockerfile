# Base image Node 18
FROM node:18-alpine

# Tạo thư mục app
WORKDIR /app

# Copy package.json
COPY package*.json ./

# Cài dependencies (production)
RUN npm install --omit=dev

# Copy source code
COPY . .

# Port của Express
EXPOSE 8080

# Start app
CMD ["node", "src/app.js"]