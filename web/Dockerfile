# 使用官方 Node.js 輕量級映像檔作為基礎映像
FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 安裝基本工具
RUN apk add --no-cache python3 make g++

# 複製 package.json 和 package-lock.json（如果存在）
COPY package*.json ./

# 安裝相依套件
RUN npm install

# 複製專案檔案
COPY . .

# 確保文件權限正確
RUN chown -R node:node /app

# 設定環境變數
ENV NODE_ENV=production

# 暴露容器端口
EXPOSE 3000

# 使用非 root 用戶運行應用
USER node

# 啟動應用程式
CMD ["npm", "start"] 