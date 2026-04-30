"""FastAPI 主入口 — 挂载路由、静态文件"""
import os
import json
import hashlib
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx

from app.config import STATIC_DIR
from app.routers import post_train

# 数据交付平台 API 配置（从环境变量读取，支持本地开发默认值）
DELIVERY_API_BASE = os.getenv("DELIVERY_API_BASE", "https://corpus.now.baidu-int.com")
DELIVERY_TOKEN = os.getenv("DELIVERY_TOKEN", "token-iyan-2025")
UUAP_COOKIES = {
    "UUAP_P_TOKEN": os.getenv("UUAP_P_TOKEN", "PT-1254541230610423810-f377effe1ecc18a6e81a807d0ee5b057eb12b07d2a6fe8e89105420bbb2448e1-uuapenc"),
    "UUAP_S_TOKEN": os.getenv("UUAP_S_TOKEN", "ST-1254543252914978817-enlhxIaRox015GBODddt-uuap"),
    "EAPTOKEN": os.getenv("EAPTOKEN", "CAT-D0rChNc7T5zMg9UXvMeZPgIHRU8s05gYS6bM9TB0FI8-42540-KkwzSbXfUPuCP05SpeNMcZqJjZ0ZnEYcypZ9Sy5McKTTxdhrwJ6gham0vYBOhG4w"),
    "ZT_SFA_TOKEN": os.getenv("ZT_SFA_TOKEN", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJkb21haW4iOiJkYXRhLnlpeWFuLmJhaWR1LWludC5jb20iLCJpYXQiOjE3NzcyOTIzNDAsInVzZXJuYW1lIjoibHZ4aWFuZzAyIiwidHlwZSI6InNmYSJ9.pADQsiHQp1HdIiOp9g7inqelKtO9BUGYPSzLSNrDHOY"),
    "ZT_GW_TOKEN": os.getenv("ZT_GW_TOKEN", "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzYWMiOiJjOmJhaWR1IiwiZGV2aWNlX2lkIjoiNTY0N0Y3MTctMDUyOC01RUJGLUE3MDMtQzlFNUYzRTM4QUIxIiwic2NoZW1lIjoiaHR0cCIsInNfdG9rZW4iOiIxdUFMNUZmTHFLUE1YalI2WXQzRC15allrd09ZY0hnVW40U3NuTm9vWDlabEhTUUlnREZlRUlZdVQ5NEN4b1FZajNMRWRBT0JrME1kM3BVZV9XdXJXdyIsImZpbmdlcnByaW50IjoiODBlNzBjY2MiLCJuYW1lIjoi5ZCV5rmYIiwicF90b2tlbiI6IlBULWEzY2Y2ZWUyNmU2ZDQ0Njc5MzAxODg0NzEwNWVkYWI4IiwiZW1haWwiOiJsdnhpYW5nMDJAYmFpZHUuY29tIiwidXNlcm5hbWUiOiJsdnhpYW5nMDIiLCJpYXQiOjE3NzczMDY4MzMsInR5cGUiOiJ1dWFwIiwiZG9tYWluIjoiZGF0YS55aXlhbi5iYWlkdS1pbnQuY29tIn0.9Tv0SjW_jgC01ZP1fJ5EmK3Gy-UJVhrUzUS7sO0PSt0"),
}

# 数据画像 API 配置（从环境变量读取，支持本地开发默认值）
DATA_ANALYSIS_HOST = os.getenv("DATA_ANALYSIS_HOST", "http://10.11.157.17:8401")
DATA_ANALYSIS_AK = os.getenv("DATA_ANALYSIS_AK", "kR7mP9vL2nQ5wX8jF3hT6bY4cA1eD7gK")
DATA_ANALYSIS_SK = os.getenv("DATA_ANALYSIS_SK", "xW4pN8sK5jH2bV9fC6mL3qR7tY1wE4aZ")
DATA_ANALYSIS_RAND = "c9b2a1d0-5e4f-3a2b-1c0d-9e8f7a6b5c4d"


def _data_analysis_headers():
    """生成数据画像 API 签名 headers"""
    ts = int(time.time())
    sign_str = f"GET{DATA_ANALYSIS_AK}{ts}{DATA_ANALYSIS_RAND}{DATA_ANALYSIS_SK}"
    sign = hashlib.sha256(sign_str.encode()).hexdigest()
    return {
        "X-ACCESS-KEY": DATA_ANALYSIS_AK,
        "X-TIMESTAMP": str(ts),
        "X-SEQ-RAND": DATA_ANALYSIS_RAND,
        "X-SIGN": sign,
    }

# 版本列表本地缓存
VERSIONS_CACHE_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "onboard_versions.json")


def _load_versions() -> list[str]:
    try:
        with open(VERSIONS_CACHE_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _save_versions(versions: list[str]):
    os.makedirs(os.path.dirname(VERSIONS_CACHE_FILE), exist_ok=True)
    with open(VERSIONS_CACHE_FILE, "w") as f:
        json.dump(versions, f, ensure_ascii=False, indent=2)


def _add_version(version: str):
    """查询成功时自动缓存版本号"""
    versions = _load_versions()
    if version and version not in versions:
        versions.insert(0, version)
        _save_versions(versions)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时无需初始化数据库
    yield


app = FastAPI(title="数据集查询系统", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST 路由
app.include_router(post_train.router)  # 后训练数据集查询路由


# ---------- 数据交付 API 代理 ----------
@app.get("/api/delivery/v3/datasource/filter_options")
async def proxy_filter_options():
    """返回版本列表，优先从远端获取，失败则用本地缓存"""
    # 1. 尝试远端（需要 UUAP cookie）
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                f"{DELIVERY_API_BASE}/api/delivery/v3/datasource/filter_options",
                headers={"token": DELIVERY_TOKEN},
                cookies=UUAP_COOKIES,
            )
            data = resp.json()
            if data.get("code") == 0:
                # 远端成功，同时更新本地缓存
                remote_versions = (data.get("data") or {}).get("onboard_versions") or []
                if remote_versions:
                    _save_versions(remote_versions)
                return JSONResponse(content=data, status_code=200)
        except Exception:
            pass

    # 2. 远端不可用，返回本地缓存
    local_versions = _load_versions()
    return JSONResponse(content={
        "code": 0, "msg": "local_cache",
        "data": {"onboard_versions": local_versions}
    }, status_code=200)


@app.post("/api/delivery/openapi/v3/datasource/list")
async def proxy_datasource_list(request: Request):
    """代理查询数据集列表，成功时自动缓存版本号"""
    body = await request.json()
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{DELIVERY_API_BASE}/api/delivery/openapi/v3/datasource/list",
            json=body,
            headers={"Content-Type": "application/json", "token": DELIVERY_TOKEN},
        )
        result = resp.json()
        # 查询成功时缓存版本号
        if result.get("code") == 0 and body.get("onboard_version"):
            _add_version(body["onboard_version"])
        return JSONResponse(content=result, status_code=resp.status_code)


@app.get("/api/delivery/v3/datasource/filter_meta")
async def proxy_filter_meta():
    """代理获取筛选字典数据"""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{DELIVERY_API_BASE}/api/delivery/v3/datasource/filter_meta",
            headers={"token": DELIVERY_TOKEN},
            cookies=UUAP_COOKIES,
        )
        return JSONResponse(content=resp.json(), status_code=resp.status_code)


@app.post("/api/delivery/versions/add")
async def add_version(request: Request):
    """手动添加版本号到本地缓存"""
    body = await request.json()
    version = body.get("version", "").strip()
    if not version:
        return JSONResponse({"code": -1, "msg": "version 不能为空"})
    _add_version(version)
    return JSONResponse({"code": 0, "msg": "ok", "data": _load_versions()})


@app.post("/api/delivery/sample-preview")
async def preview_sample_data(request: Request):
    """通过 get_bos_url 获取签名 URL，再下载 JSONL 前 N 条供前端预览"""
    body = await request.json()
    bos_path = body.get("bos_path", "")
    limit = min(body.get("limit", 20), 100)

    if not bos_path or not bos_path.startswith("bos://"):
        return JSONResponse({"code": -1, "msg": "无效的 BOS 路径", "data": []})

    try:
        from urllib.parse import quote
        encoded_path = quote(bos_path, safe="")
        async with httpx.AsyncClient(timeout=30) as client:
            # 1. 用 UUAP cookie 获取签名下载 URL
            sign_resp = await client.get(
                f"{DELIVERY_API_BASE}/api/lakehouse/v3/produce/get_bos_url?bos_url={encoded_path}",
                cookies=UUAP_COOKIES,
            )
            sign_data = sign_resp.json()
            if sign_data.get("code") != 0:
                return JSONResponse({
                    "code": -2,
                    "msg": f"获取签名 URL 失败: {sign_data.get('msg', '')}",
                    "data": []
                })

            signed_url = sign_data["data"]["bos_url"]

            # 2. 用签名 URL 流式下载，只读前 N 行
            rows = []
            async with client.stream("GET", signed_url, timeout=30) as resp:
                if resp.status_code != 200:
                    return JSONResponse({
                        "code": -3,
                        "msg": f"BOS 下载失败: HTTP {resp.status_code}",
                        "data": []
                    })
                buf = ""
                async for chunk in resp.aiter_text():
                    buf += chunk
                    while "\n" in buf:
                        line, buf = buf.split("\n", 1)
                        line = line.strip()
                        if line:
                            try:
                                rows.append(json.loads(line))
                            except json.JSONDecodeError:
                                rows.append({"_raw": line[:500]})
                        if len(rows) >= limit:
                            break
                    if len(rows) >= limit:
                        break

        return JSONResponse({"code": 0, "msg": "", "data": rows, "total_loaded": len(rows)})

    except Exception as e:
        return JSONResponse({"code": -99, "msg": str(e)[:200], "data": []})


# 数据查询页面
@app.get("/data-query")
async def data_query_page():
    return FileResponse(str(STATIC_DIR / "data-query.html"))


# ---------- 数据画像 API 代理 ----------
@app.get("/api/data-analysis/statistics/tag")
async def proxy_data_analysis_tag(tag_name: str, dimension: str, type: int = 0):
    """代理数据画像统计接口"""
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(
                f"{DATA_ANALYSIS_HOST}/openapi/v1/dataAnalysis/statistics/tag",
                params={"tag_name": tag_name, "dimension": dimension, "type": type},
                headers=_data_analysis_headers(),
            )
            return JSONResponse(content=resp.json(), status_code=resp.status_code)
        except Exception as e:
            return JSONResponse({"code": -1, "message": str(e)[:200], "data": None})


# 静态文件 (前端)
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    @app.get("/")
    async def index():
        return FileResponse(str(STATIC_DIR / "data-query.html"))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8888))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
