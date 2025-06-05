# 使用官方 Python 映像檔作為基礎映像
FROM python:3.10-slim

# 設定工作目錄
WORKDIR /app

# 安裝系統依賴
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 複製 requirements.txt
COPY requirements.txt .

# 安裝 Python 依賴
RUN pip install --no-cache-dir -r requirements.txt

# 複製專案檔案
COPY . .

# 建立並設定環境變數檔案
RUN touch .env

# 設定環境變數
ENV PYTHONUNBUFFERED=1

# 建立非 root 用戶
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# 設定容器啟動命令
CMD ["python", "cpmodel_2025.py"] 