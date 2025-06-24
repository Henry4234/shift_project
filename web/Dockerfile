# 使用官方 nginx 映像檔作為基礎映像
FROM nginx:alpine

# 複製前端檔案到 nginx 的預設目錄
COPY . /usr/share/nginx/html/

# 複製自訂的 nginx 配置檔案
COPY nginx.conf /etc/nginx/nginx.conf

# 暴露容器端口
EXPOSE 80

# 啟動 nginx
CMD ["nginx", "-g", "daemon off;"] 