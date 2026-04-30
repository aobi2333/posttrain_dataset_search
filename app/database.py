"""
数据库配置

当前项目只提供数据查询功能，保留数据库基础设施以避免导入错误。
"""
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    """数据库会话生成器（保留以避免导入错误）"""
    async with async_session() as session:
        yield session


async def init_db():
    """初始化数据库（当前无需初始化）"""
    pass
