# 使用 Node.js 官方映像作為基礎映像
FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm install

# 複製專案檔案
COPY . .

# 預設啟動指令（可根據實際情況調整）
CMD ["npm", "start"]

# 容器對外暴露的端口（可根據專案實際端口調整）
EXPOSE 3000