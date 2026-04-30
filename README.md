# Ratio Collab - 数据集查询系统

## 本地开发

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
python -m app.main
# 或
uvicorn app.main:app --reload --port 8888
```

访问 http://localhost:8888

## 部署到 Render

### 方式1: 使用 Render Dashboard（推荐）

1. 访问 https://dashboard.render.com/
2. 点击 "New +" -> "Web Service"
3. 连接你的 GitHub/GitLab 仓库
4. 填写配置：
   - **Name**: `ratio-collab`
   - **Region**: 选择离你最近的区域
   - **Branch**: `main`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. 设置环境变量（Environment Variables）:
   - `DELIVERY_TOKEN`: 你的 delivery API token
   - `DATA_ANALYSIS_AK`: 数据画像 AK
   - `DATA_ANALYSIS_SK`: 数据画像 SK
   - `UUAP_P_TOKEN`: UUAP P Token
   - `UUAP_S_TOKEN`: UUAP S Token
   - `EAPTOKEN`: EAP Token
   - `ZT_SFA_TOKEN`: ZT SFA Token
   - `ZT_GW_TOKEN`: ZT GW Token
6. 点击 "Create Web Service"

### 方式2: 使用 render.yaml（Infrastructure as Code）

1. 确保仓库根目录有 `render.yaml` 文件
2. 访问 https://dashboard.render.com/
3. 点击 "New +" -> "Blueprint"
4. 连接仓库并选择 `render.yaml`
5. 在 Render Dashboard 中配置环境变量（标记为 `sync: false` 的变量）
6. 部署

### 注意事项

- Render 免费计划有以下限制：
  - 服务会在 15 分钟无活动后休眠
  - 每月 750 小时免费运行时间
  - 首次访问休眠服务可能需要等待 30-60 秒

- 如果你的 API 地址（如 `http://10.11.157.17:8401`）是内网地址，Render 服务器无法访问，需要：
  - 使用公网可访问的 API 地址
  - 或在百度内网部署

## 架构说明

- **FastAPI**: Web 框架
- **Uvicorn**: ASGI 服务器
- **SQLAlchemy**: ORM（如果使用数据库）
- **httpx**: 异步 HTTP 客户端

## API 端点

- `GET /` - 主页
- `GET /data-query` - 数据查询页面
- `POST /api/post-train/query` - 后训练数据集查询
- `POST /api/delivery/openapi/v3/datasource/list` - 数据集列表代理
- `GET /api/data-analysis/statistics/tag` - 数据画像统计代理
