import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# 数据库
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{BASE_DIR / 'data.db'}")

# 静态文件
STATIC_DIR = BASE_DIR / "static"

# 文件上传目录
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# 协同配置
LOCK_TIMEOUT_SECONDS = 30  # 单元格锁超时(秒)

# 用户色板 (协同编辑时分配颜色)
USER_COLORS = [
    "#4955f5", "#e8553d", "#15b25e", "#ff8c00", "#722ed1",
    "#08979c", "#d46b08", "#1d39c4", "#cf1322", "#389e0d",
]

# Mock 数据模式（Render 部署时自动启用，因为无法访问内网 API）
USE_MOCK_DATA = os.getenv("USE_MOCK_DATA", "true").lower() == "true"
