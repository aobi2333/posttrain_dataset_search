"""
路由模块导出

导出所有路由模块供 main.py 使用
"""
from app.routers import post_train

__all__ = ["post_train"]
