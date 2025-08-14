# 排班系統

這是一個基於 OR-Tools 的排班系統，使用 Python Flask 作為後端 API，Supabase 作為資料庫，前端使用純 HTML/JavaScript，並由 Nginx 提供靜態檔案服務。

## 環境需求

- Docker
- Docker Compose
- Python 3.10+ (本地開發)

## 快速開始

1. 複製環境變數範本並填入你的 Supabase 認證資訊：
   ```bash
   cp .env.example .env
   ```
   編輯 `.env` 文件並填入：
   ```
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_KEY=your_supabase_anon_key_here
   SUPABASE_DB_HOST=your_supabase_db_host_here
   SUPABASE_DB_PORT=5432
   SUPABASE_DB_NAME=postgres
   SUPABASE_DB_USER=postgres
   SUPABASE_DB_PASSWORD=your_supabase_db_password_here
   ```

2. 使用 Docker Compose 建立並啟動服務：
   ```bash
   docker-compose up --build
   ```

這將會：
- 建立並啟動 Flask 後端 API（運行在 http://localhost:5000）
- 建立並啟動 Nginx 前端服務（運行在 http://localhost:80）
- 前端會自動代理 API 請求到後端

## 如何進入前端

啟動服務後，您可以透過以下方式進入前端：

1. **瀏覽器訪問**：
   - 開啟瀏覽器，訪問 `http://localhost` 或 `http://localhost:80`
   - 或者直接訪問 `http://127.0.0.1`

2. **API 測試**：
   - 後端 API 可以直接訪問：`http://localhost:5000/api/employees`
   - 前端會自動代理 `/api/*` 請求到後端

## 專案結構

```
.
├── web/                    # Web 前端靜態檔案
│   ├── index.html         # 主頁面
│   ├── style.css          # 樣式檔案
│   ├── appscript.js       # 主要 JavaScript 邏輯
│   ├── add_member.js      # 新增員工功能
│   ├── employeesmode.js   # 員工模式功能
│   ├── swichmode.js       # 模式切換功能
│   ├── employee_config.js # 員工設定功能
│   ├── shifttype_config.js # 班別設定功能
│   ├── sidebar.js         # 側邊欄功能
│   ├── Dockerfile         # 前端 Docker 配置
│   └── nginx.conf         # Nginx 配置檔案
├── api.py                 # Flask 後端 API
├── cpmodel_2025.py        # 排班系統核心
├── supabase_client.py     # Supabase 客戶端
├── requirements.txt       # Python 依賴
├── Dockerfile            # 後端 Docker 配置
├── docker-compose.yml    # Docker Compose 配置
├── db_shift_type.sql     # 班別類型表格初始化 SQL
├── .env.example          # 環境變數範本
└── README.md            # 本文件
```

## API 端點

### 員工管理
- `GET /api/employees` - 獲取所有員工資料
- `POST /api/employees` - 新增員工
- `GET /api/employee-preferences` - 獲取員工偏好設定
- `POST /api/employee-preferences/<id>` - 更新員工偏好設定
- `POST /api/employee-amount/<id>` - 更新員工班別數量

### 班別類型管理
- `GET /api/shift-types` - 獲取所有班別類型資料
- `POST /api/shift-types` - 新增班別類型
- `PUT /api/shift-types/<id>` - 更新班別類型
- `DELETE /api/shift-types/<id>` - 刪除班別類型

### 班表管理
- `GET /api/shift-requirements` - 獲取班表需求
- `GET /api/employee-schedules` - 獲取員工班表
- `POST /api/run-schedule` - 執行排班模型

## 資料庫結構

系統使用 Supabase 作為後端資料庫，包含以下表格：

1. `employees` - 員工資料
   - `id`: 序號 (主鍵)
   - `name`: 員工姓名
   - `created_at`: 建立時間

2. `shift_requirements` - 班次需求
   - `id`: 序號 (主鍵)
   - `employee_id`: 員工 ID (外鍵)

3. `shift_type` - 班別類型定義
   - `id`: 序號 (主鍵)
   - `shift_name`: 班別名稱 (例如：早班、中班、夜班)
   - `shift_subname`: 班別副名稱 (例如：A班、B班、C班)
   - `shift_group`: 班別分組 (例如：白班、小夜、大夜)
   - `start_time`: 班別開始時間
   - `end_time`: 班別結束時間
   - `created_at`: 建立時間
   - `shift_type`: 班別類型 ('A', 'B', 'C')
   - `required_days`: 需求天數
   - `created_at`: 建立時間

3. `employee_preferences` - 員工偏好設定
   - `id`: 序號 (主鍵)
   - `employee_id`: 員工 ID (外鍵)
   - `max_continuous_days`: 最大連續工作天數限制
   - `continuous_c`: 連續大夜班限制
   - `double_off_after_c`: 大夜班後雙休
   - `created_at`: 建立時間

4. `employee_schedules` - 員工班表
   - `id`: 序號 (主鍵)
   - `employee_id`: 員工 ID (外鍵)
   - `work_date`: 工作日期
   - `shift_type`: 班別類型
   - `created_at`: 建立時間

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

3. 運行 Flask 後端：
   ```bash
   python api.py
   ```

4. 開啟 `web/index.html` 在瀏覽器中查看前端

### 使用 Docker

使用 Docker 可以確保在任何環境中都能一致地運行：

```bash
# 建立並啟動所有服務
docker-compose up --build

# 只重新建立特定服務
docker-compose up --build frontend
docker-compose up --build backend

# 停止所有服務
docker-compose down

# 查看日誌
docker-compose logs frontend
docker-compose logs backend

# 進入容器進行除錯
docker-compose exec frontend sh
docker-compose exec backend bash
```

## 技術架構

- **前端**: Nginx + 純 HTML/JavaScript/CSS
- **後端**: Python Flask + psycopg2 (PostgreSQL 連線)
- **資料庫**: Supabase (PostgreSQL)
- **排班引擎**: OR-Tools (Google Operations Research)
- **容器化**: Docker + Docker Compose
- **反向代理**: Nginx 代理 API 請求到後端

## 服務架構

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   瀏覽器        │    │   Nginx 前端    │    │  Flask 後端     │
│                 │    │   (Port 80)     │    │  (Port 5000)    │
│ http://localhost│───▶│  靜態檔案服務   │───▶│   API 服務      │
│                 │    │  API 代理       │    │  資料庫連線     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │   Supabase      │
                                               │   PostgreSQL    │
                                               └─────────────────┘
```

## 錯誤處理

所有 API 端點都包含完整的錯誤處理：
- 資料庫連線錯誤
- 資料驗證錯誤
- 業務邏輯錯誤
- 系統異常

錯誤回應格式：
```json
{
  "error": "錯誤訊息描述"
}
```

## 環境變數說明

| 變數名稱 | 說明 | 範例 |
|---------|------|------|
| SUPABASE_URL | Supabase 專案 URL | https://xxx.supabase.co |
| SUPABASE_KEY | Supabase 匿名金鑰 | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... |
| SUPABASE_DB_HOST | 資料庫主機 | db.xxx.supabase.co |
| SUPABASE_DB_PORT | 資料庫端口 | 5432 |
| SUPABASE_DB_NAME | 資料庫名稱 | postgres |
| SUPABASE_DB_USER | 資料庫用戶 | postgres |
| SUPABASE_DB_PASSWORD | 資料庫密碼 | your_password |

## 故障排除

### 前端無法訪問
1. 檢查 Nginx 容器是否正常運行：`docker-compose logs frontend`
2. 確認端口 80 沒有被其他服務佔用
3. 檢查防火牆設定

### 後端 API 無法連接
1. 檢查 Flask 容器是否正常運行：`docker-compose logs backend`
2. 確認環境變數設定正確
3. 檢查資料庫連線設定

### 資料庫連線問題
1. 確認 Supabase 專案設定正確
2. 檢查資料庫連線字串
3. 確認網路連線正常 