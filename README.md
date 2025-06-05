# 排班系統

這是一個基於 OR-Tools 的排班系統，使用 Supabase 作為後端資料庫。

## 環境需求

- Docker
- Docker Compose

## 快速開始

1. 複製環境變數範本並填入你的 Supabase 認證資訊：
   ```bash
   cp .env.example .env
   ```
   編輯 `.env` 文件並填入：
   ```
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_KEY=your_supabase_key_here
   ```

2. 使用 Docker Compose 建立並啟動服務：
   ```bash
   docker-compose up --build
   ```

這將會：
- 建立並啟動 Web 介面（運行在 http://localhost:3000）
- 建立並啟動排班系統後端

## 專案結構

```
.
├── web/                    # Web 前端
│   ├── Dockerfile         # Web 服務的 Docker 配置
│   └── ...
├── cpmodel_2025.py        # 排班系統核心
├── supabase_client.py     # Supabase 客戶端
├── requirements.txt       # Python 依賴
├── Dockerfile            # 排班系統的 Docker 配置
├── docker-compose.yml    # Docker Compose 配置
└── README.md            # 本文件
```

## 資料庫結構

系統使用 Supabase 作為後端資料庫，包含以下表格：

1. `employees` - 員工資料
   - `id`: 序號 (主鍵)
   - `name`: 員工姓名

2. `shift_requirements` - 班次需求
   - `id`: 序號 (主鍵)
   - `employee_id`: 員工 ID (外鍵)
   - `shift_type`: 班別類型 ('A', 'B', 'C')
   - `required_days`: 需求天數

3. `employee_preferences` - 員工偏好設定
   - `id`: 序號 (主鍵)
   - `employee_id`: 員工 ID (外鍵)
   - `max_continuous_days`: 最大連續工作天數限制
   - `continuous_c`: 連續大夜班限制
   - `double_off_after_c`: 大夜班後雙休

## 開發說明

### 本地開發

如果你想在本地開發而不使用 Docker：

1. 安裝 Python 依賴：
   ```bash
   pip install -r requirements.txt
   ```

2. 設定環境變數：
   ```bash
   cp .env.example .env
   # 編輯 .env 文件
   ```

3. 運行排班系統：
   ```bash
   python cpmodel_2025.py
   ```

### 使用 Docker

使用 Docker 可以確保在任何環境中都能一致地運行：

```bash
# 建立並啟動所有服務
docker-compose up --build

# 只重新建立特定服務
docker-compose up --build scheduler

# 停止所有服務
docker-compose down
``` 