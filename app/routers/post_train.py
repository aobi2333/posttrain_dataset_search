"""
后训练数据集查询 API 路由

功能:
1. 获取后训练项目列表(固定4个项目)
2. 获取项目的 Tag 列表
3. 获取 Tag 聚合信息(基本信息+画像+蓝军质检)
4. 获取数据集列表
5. 获取质检报告
6. 数据预览和下载
"""
from fastapi import APIRouter, Query, HTTPException, Request
from typing import Optional, Dict, Any, List
import httpx
import asyncio
import logging
import hashlib
import time

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/post-train", tags=["post-train"])

# API 配置 (从 main.py 导入或在这里定义)
DATA_PLATFORM_BASE = "http://data.yiyan.baidu-int.com"
LANJUN_QC_BASE = "http://data.yiyan.baidu-int.com"
DATA_ANALYSIS_HOST = "http://10.11.157.17:8401"
DATA_ANALYSIS_AK = "kR7mP9vL2nQ5wX8jF3hT6bY4cA1eD7gK"
DATA_ANALYSIS_SK = "xW4pN8sK5jH2bV9fC6mL3qR7tY1wE4aZ"
DATA_ANALYSIS_RAND = "c9b2a1d0-5e4f-3a2b-1c0d-9e8f7a6b5c4d"

# UUAP Cookies (从 main.py 导入或在这里定义)
UUAP_COOKIES = {
    "UUAP_P_TOKEN": "PT-1254541230610423810-f377effe1ecc18a6e81a807d0ee5b057eb12b07d2a6fe8e89105420bbb2448e1-uuapenc",
    "UUAP_S_TOKEN": "ST-1254543252914978817-enlhxIaRox015GBODddt-uuap",
    "EAPTOKEN": "CAT-D0rChNc7T5zMg9UXvMeZPgIHRU8s05gYS6bM9TB0FI8-42540-KkwzSbXfUPuCP05SpeNMcZqJjZ0ZnEYcypZ9Sy5McKTTxdhrwJ6gham0vYBOhG4w",
    "ZT_SFA_TOKEN": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJkb21haW4iOiJkYXRhLnlpeWFuLmJhaWR1LWludC5jb20iLCJpYXQiOjE3NzcyOTIzNDAsInVzZXJuYW1lIjoibHZ4aWFuZzAyIiwidHlwZSI6InNmYSJ9.pADQsiHQp1HdIiOp9g7inqelKtO9BUGYPSzLSNrDHOY",
    "ZT_GW_TOKEN": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzYWMiOiJjOmJhaWR1IiwiZGV2aWNlX2lkIjoiNTY0N0Y3MTctMDUyOC01RUJGLUE3MDMtQzlFNUYzRTM4QUIxIiwic2NoZW1lIjoiaHR0cCIsInNfdG9rZW4iOiIxdUFMNUZmTHFLUE1YalI2WXQzRC15allrd09ZY0hnVW40U3NuTm9vWDlabEhTUUlnREZlRUlZdVQ5NEN4b1FZajNMRWRBT0JrME1kM3BVZV9XdXJXdyIsImZpbmdlcnByaW50IjoiODBlNzBjY2MiLCJuYW1lIjoi5ZCV5rmYIiwicF90b2tlbiI6IlBULWEzY2Y2ZWUyNmU2ZDQ0Njc5MzAxODg0NzEwNWVkYWI4IiwiZW1haWwiOiJsdnhpYW5nMDJAYmFpZHUuY29tIiwidXNlcm5hbWUiOiJsdnhpYW5nMDIiLCJpYXQiOjE3NzczMDY4MzMsInR5cGUiOiJ1dWFwIiwiZG9tYWluIjoiZGF0YS55aXlhbi5iYWlkdS1pbnQuY29tIn0.9Tv0SjW_jgC01ZP1fJ5EmK3Gy-UJVhrUzUS7sO0PSt0",
}


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


def _common_headers():
    """生成通用请求头"""
    return {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "http://data.yiyan.baidu-int.com/index",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }


async def get_all_items(
    client: httpx.AsyncClient,
    url: str,
    params: Dict[str, Any],
    max_items: int = 10000,
    max_pages: int = 100
) -> List[Dict[str, Any]]:
    """
    通用的获取全量数据方法

    策略:
    1. 先尝试用大 pageSize (1000) 一次性获取
    2. 如果数据量超过限制,则降级为循环分页
    3. 设置最大条数和最大页数限制,防止无限查询

    Args:
        client: httpx 客户端
        url: 接口URL
        params: 查询参数
        max_items: 最多获取的条数
        max_pages: 最多翻页数

    Returns:
        所有数据的列表
    """
    # 策略1: 先尝试大 pageSize
    try_params = {**params, "current": 1, "pageSize": 1000}

    try:
        resp = await client.get(url, params=try_params, headers=_common_headers(), timeout=30)
        resp.raise_for_status()
        data = resp.json()

        # 处理不同的响应格式
        if "data" in data:
            if isinstance(data["data"], dict):
                total = data["data"].get("total", 0)
                items = data["data"].get("list", []) or data["data"].get("datas", [])
            elif isinstance(data["data"], list):
                items = data["data"]
                total = len(items)
            else:
                items = []
                total = 0
        else:
            items = []
            total = 0

        # 如果一次就拿完了,直接返回
        if len(items) >= total or total <= 1000:
            logger.info(f"Fetched all {len(items)} items in one request from {url}")
            return items

        # 策略2: 数据量大,降级为循环分页
        logger.info(f"Total items: {total}, fetching remaining pages...")
        all_items = items  # 保留第一页的数据
        current_page = 2
        page_size = 100

        while len(all_items) < total and len(all_items) < max_items and current_page <= max_pages:
            resp = await client.get(
                url,
                params={**params, "current": current_page, "pageSize": page_size},
                headers=_common_headers(),
                timeout=30
            )
            resp.raise_for_status()
            data = resp.json()

            if "data" in data:
                if isinstance(data["data"], dict):
                    page_items = data["data"].get("list", []) or data["data"].get("datas", [])
                elif isinstance(data["data"], list):
                    page_items = data["data"]
                else:
                    page_items = []
            else:
                page_items = []

            if not page_items:
                break

            all_items.extend(page_items)
            logger.info(f"Fetched page {current_page}, total items: {len(all_items)}/{total}")
            current_page += 1

        return all_items

    except Exception as e:
        logger.error(f"Error fetching data from {url}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取数据失败: {str(e)}")


# ============= API 端点 =============

@router.get("/projects")
async def get_post_train_projects():
    """
    获取后训练项目列表(固定4个项目)

    Returns:
        后训练项目列表
    """
    return {
        "code": 0,
        "data": [
            {"project_id": "1264", "project_name": "eb5_data_sft_all"},
            {"project_id": "1363", "project_name": "eb5v_data_sftthink_all"},
            {"project_id": "1516", "project_name": "eb5_data_sft_all_arena"},
            {"project_id": "1265", "project_name": "eb5_data_ppo_all"}
        ]
    }


@router.get("/tags")
async def get_post_train_tags(project_name: str = Query(..., description="项目名称,如 eb5_data_sft_all")):
    """
    获取指定后训练项目的 Tag 列表(全量)

    Args:
        project_name: 项目名称

    Returns:
        Tag 列表
    """
    async with httpx.AsyncClient(timeout=60, cookies=UUAP_COOKIES) as client:
        try:
            # 获取全量 Tag 列表 - 使用 project_id 参数
            tags = await get_all_items(
                client,
                f"{DATA_PLATFORM_BASE}/data/project/tag/list",
                {"project_id": project_name}  # 后端API实际需要project_id参数
            )

            return {
                "code": 0,
                "data": tags,
                "total": len(tags)
            }
        except HTTPException as e:
            raise e
        except Exception as e:
            logger.error(f"Error fetching tags for {project_name}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"获取Tag列表失败: {str(e)}")


@router.get("/tag-datasets")
async def get_tag_datasets(
    project_id: str = Query(..., description="横向项目ID（数字）"),
    tag_name: str = Query(..., description="Tag名称")
):
    """
    通过横向项目ID和Tag名称获取所有专项Tag下的实际数据集

    逻辑：
    1. 先查询横向Tag下的专项引用（REF对象）
    2. 遍历每个REF，查询专项项目下的实际数据集
    3. 汇总返回所有数据集

    Args:
        project_id: 横向项目ID（如 1264）
        tag_name: Tag名称（如 26.03.25-eb5_data_sft_all-V4-270-D0-V1）

    Returns:
        数据集列表和统计信息
    """

    # 根据项目ID推断数据集类型
    def get_dataset_type_by_project(proj_id: str, proj_name: str = "") -> str:
        """根据项目ID或项目名称推断数据集类型"""
        # 优先从项目名称判断
        if proj_name:
            proj_name_lower = proj_name.lower()
            if "ppo" in proj_name_lower:
                return "PPO"
            elif "sft" in proj_name_lower:
                return "SFT"
            elif "dpo" in proj_name_lower:
                return "DPO"

        # 从项目ID判断（根据已知的项目映射）
        project_type_map = {
            "1264": "SFT",   # eb5_data_sft_all
            "1363": "SFT",   # eb5v_data_sftthink_all
            "1516": "SFT",   # eb5_data_sft_all_arena
            "1265": "PPO",   # eb5_data_ppo_all
        }
        return project_type_map.get(proj_id, "SFT")  # 默认为SFT

    async with httpx.AsyncClient(timeout=180, cookies=UUAP_COOKIES) as client:
        try:
            # 第一步：查询横向Tag下的专项引用（REF对象）
            response = await client.get(
                f"{DATA_PLATFORM_BASE}/data/dataset/list",
                params={
                    "project_id": project_id,
                    "tag_name": tag_name,
                    "current": 1,
                    "pageSize": 1000
                },
                headers=_common_headers(),
                timeout=120
            )
            response.raise_for_status()
            result = response.json()

            if result.get("code") != 0 or not result.get("data"):
                return result

            data = result["data"]
            ref_objects = data.get("datas") or data.get("list") or []

            logger.info(f"Found {len(ref_objects)} special tag references for project {project_id}, tag {tag_name}")

            # 第二步：遍历每个专项Tag引用，查询实际数据集
            all_datasets = []
            special_tag_count = 0
            all_special_projects = []  # 记录所有专项信息（包括没有数据的）

            for ref_obj in ref_objects:
                ref_project_id = ref_obj.get("ref_project_id")
                ref_tag_name = ref_obj.get("ref_tag")
                ref_project_name = ref_obj.get("ref_project_name", "")

                if not ref_project_id or not ref_tag_name:
                    logger.warning(f"Skipping ref object without ref_project_id or ref_tag: {ref_obj.get('name')}")
                    continue

                special_tag_count += 1

                # 记录专项信息
                special_info = {
                    "project_id": ref_project_id,
                    "project_name": ref_project_name,
                    "tag_name": ref_tag_name,
                    "has_data": False,
                    "dataset_count": 0
                }

                try:
                    # 查询该专项Tag下的数据集
                    ds_response = await client.get(
                        f"{DATA_PLATFORM_BASE}/data/dataset/list",
                        params={
                            "project_id": str(ref_project_id),
                            "tag_name": ref_tag_name,
                            "current": 1,
                            "pageSize": 1000
                        },
                        headers=_common_headers(),
                        timeout=60
                    )
                    ds_response.raise_for_status()
                    ds_result = ds_response.json()

                    if ds_result.get("code") == 0 and ds_result.get("data"):
                        ds_data = ds_result["data"]
                        datasets = ds_data.get("datas") or ds_data.get("list") or []

                        if datasets:
                            # 推断数据集类型
                            dataset_type = get_dataset_type_by_project(str(ref_project_id), ref_project_name)

                            # 为每个数据集添加专项来源信息
                            for ds in datasets:
                                ds["_special_project_id"] = ref_project_id
                                ds["_special_project_name"] = ref_project_name
                                ds["_special_tag_name"] = ref_tag_name
                                ds["_dataset_type"] = dataset_type  # 添加数据集类型

                            all_datasets.extend(datasets)
                            special_info["has_data"] = True
                            special_info["dataset_count"] = len(datasets)
                            logger.info(f"Fetched {len(datasets)} datasets from {ref_project_name}/{ref_tag_name}")
                        else:
                            logger.info(f"No datasets found for {ref_project_name}/{ref_tag_name}")

                except Exception as e:
                    logger.error(f"Error fetching datasets from {ref_project_name}/{ref_tag_name}: {str(e)}")

                # 无论是否有数据，都记录这个专项
                all_special_projects.append(special_info)

            # 计算统计信息
            total_data_count = sum(ds.get("amount", 0) for ds in all_datasets)
            total_dataset_count = len(all_datasets)

            logger.info(f"Total: {total_dataset_count} datasets, {total_data_count} data items from {special_tag_count} special tags")
            logger.info(f"Special projects: {len(all_special_projects)} total, {sum(1 for sp in all_special_projects if sp['has_data'])} with data")

            return {
                "code": 0,
                "data": {
                    "summary": {
                        "total_data_count": total_data_count,
                        "total_dataset_count": total_dataset_count,
                        "special_tag_count": special_tag_count
                    },
                    "datasets": all_datasets,
                    "all_special_projects": all_special_projects  # 新增：所有专项列表
                }
            }

        except Exception as e:
            logger.error(f"Error in get_tag_datasets: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"获取Tag数据集失败: {str(e)}")


@router.get("/tag-info")
async def get_tag_info(
    project_name: str = Query(..., description="横向项目ID（数字）,如 1264"),
    tag_name: str = Query(..., description="横向项目的上车Tag名称,如 26.03.25-eb5_data_sft_all-V4")
):
    """
    获取横向项目上车 Tag 的完整信息(基本信息+画像+蓝军质检)

    逻辑说明:
    1. 横向项目的某个 Tag 下包含多个专项 Tag
    2. 需要聚合所有专项 Tag 下所有数据集的统计信息

    注意: 这里获取的是"Tag 信息",而不是"上车批次(plan)信息"

    Args:
        project_name: 横向项目ID（数字）
        tag_name: Tag 名称

    Returns:
        Tag 完整信息(基本信息+画像+蓝军质检)
    """
    async with httpx.AsyncClient(timeout=120, cookies=UUAP_COOKIES) as client:
        try:
            # 步骤1: 获取横向项目的 Tag 信息
            tags = await get_all_items(
                client,
                f"{DATA_PLATFORM_BASE}/data/project/tag/list",
                {"project_id": project_name}  # 使用project_id参数
            )

            # 找到匹配的 Tag
            target_tag = None
            for tag in tags:
                if tag.get("tag_name") == tag_name:
                    target_tag = tag
                    break

            if not target_tag:
                raise HTTPException(status_code=404, detail=f"未找到 Tag: {tag_name}")

            tag_id = target_tag.get("tag_id") or target_tag.get("id")

            # 步骤2: 通过上车记录获取专项 Tag 列表
            # 先查询该 Tag 对应的上车批次
            plan_list = await get_all_items(
                client,
                f"{DATA_PLATFORM_BASE}/data/dataset/aboard/plan/list",
                {"project_id": project_name}  # 使用project_id参数
            )

            # 找到匹配该 Tag 的上车批次
            plan_id = None
            for plan in plan_list:
                if str(plan.get("tag_id")) == str(tag_id) or plan.get("tag_name") == tag_name:
                    plan_id = plan.get("plan_id") or plan.get("id")
                    break

            if not plan_id:
                # 如果没有找到对应的上车批次,返回空统计
                logger.warning(f"No plan found for tag {tag_name}")
                return {
                    "code": 0,
                    "data": {
                        "tag_info": {
                            "data_count": 0,
                            "token_count": None,
                            "dataset_count": 0,
                            "schema_type": "EB5",
                            "modal_type": "多模" if str(project_name).startswith("1363") else "文本",
                            "rd_owner": "未知",
                            "last_update_time": "未知"
                        },
                        "portrait": {},
                        "blue_army_qc": {"status": "NOT_TRIGGERED"}
                    }
                }

            # 获取该上车批次下的所有专项 Tag 列表
            special_list = await get_all_items(
                client,
                f"{DATA_PLATFORM_BASE}/data/dataset/aboard/plan/detail/special/list",
                {"plan_id": plan_id}
            )

            logger.info(f"Found {len(special_list)} special tags for plan {plan_id}")

            # 步骤3: 聚合统计信息
            total_data_count = 0
            total_dataset_count = 0
            latest_dataset = None
            latest_update_time = None

            # 遍历每个专项 Tag,获取其数据集并统计
            for special in special_list:
                special_project_id = special.get("project_id")
                special_tag_id = special.get("tag_id")

                if not special_project_id or not special_tag_id:
                    continue

                try:
                    # 获取该专项 Tag 下的所有数据集
                    datasets = await get_all_items(
                        client,
                        f"{DATA_PLATFORM_BASE}/data/dataset/list",
                        {
                            "project_id": special_project_id,
                            "tag_id": special_tag_id
                        }
                    )

                    # 累加数据条数和数据集数量,同时找出最后更新的数据集
                    for dataset in datasets:
                        total_data_count += dataset.get("amount", 0)
                        total_dataset_count += 1

                        # 找出最后更新的数据集(用于获取 rd_owner)
                        update_time = dataset.get("update_time")
                        if update_time:
                            if latest_update_time is None or update_time > latest_update_time:
                                latest_update_time = update_time
                                latest_dataset = dataset

                except Exception as e:
                    logger.error(f"Error fetching datasets for special {special_project_id}: {str(e)}")
                    continue

            # 步骤4: 判断 Schema 类型和数据模态
            schema_type = "EB5"  # 默认都是 EB5

            # 根据项目ID判断数据模态
            if str(project_name) == "1363":  # eb5v_data_sftthink_all
                modal_type = "多模"
            else:
                modal_type = "文本"

            # 获取最后更新数据集的负责人
            rd_owner = latest_dataset.get("updater_name", "未知") if latest_dataset else "未知"
            last_update_time = str(latest_update_time) if latest_update_time else "未知"

            # 返回聚合后的完整信息
            return {
                "code": 0,
                "data": {
                    "tag_info": {
                        "data_count": total_data_count,
                        "token_count": None,  # Token 量(暂无)
                        "dataset_count": total_dataset_count,
                        "schema_type": schema_type,
                        "modal_type": modal_type,
                        "rd_owner": rd_owner,
                        "last_update_time": last_update_time
                    },
                    "portrait": {},
                    "blue_army_qc": {"status": "NOT_TRIGGERED"}
                }
            }

        except HTTPException as e:
            raise e
        except Exception as e:
            logger.error(f"Error in get_tag_info: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"获取Tag信息失败: {str(e)}")


@router.get("/aboard-plans")
async def get_aboard_plans(project_id: str = Query(..., description="项目ID")):
    """获取上车批次列表"""
    async with httpx.AsyncClient(timeout=60, cookies=UUAP_COOKIES) as client:
        try:
            plans = await get_all_items(
                client,
                f"{DATA_PLATFORM_BASE}/data/dataset/aboard/plan/list",
                {"project_id": project_id}
            )
            return {
                "code": 0,
                "data": {"datas": plans}
            }
        except Exception as e:
            logger.error(f"Error fetching aboard plans: {str(e)}")
            raise HTTPException(status_code=500, detail=f"获取上车批次列表失败: {str(e)}")


@router.get("/special-tags")
async def get_special_tags(plan_id: str = Query(..., description="上车批次ID")):
    """获取专项Tag列表"""
    async with httpx.AsyncClient(timeout=60, cookies=UUAP_COOKIES) as client:
        try:
            special_list = await get_all_items(
                client,
                f"{DATA_PLATFORM_BASE}/data/dataset/aboard/plan/detail/special/list",
                {"plan_id": plan_id}
            )
            return {
                "code": 0,
                "data": {"datas": special_list}
            }
        except Exception as e:
            logger.error(f"Error fetching special tags: {str(e)}")
            raise HTTPException(status_code=500, detail=f"获取专项Tag列表失败: {str(e)}")


@router.get("/datasets")
async def get_post_train_datasets(
    project_name: str = Query(..., description="项目ID（数字）"),
    tag_id: str = Query(..., description="Tag ID"),
    current: int = Query(1, description="当前页码"),
    page_size: int = Query(20, description="每页大小")
):
    """
    获取后训练数据集列表(分页)

    Args:
        project_name: 项目ID（数字，如1264）
        tag_id: Tag ID
        current: 当前页码
        page_size: 每页大小

    Returns:
        数据集列表
    """
    async with httpx.AsyncClient(timeout=120, cookies=UUAP_COOKIES) as client:  # 增加超时到120秒
        try:
            resp = await client.get(
                f"{DATA_PLATFORM_BASE}/data/dataset/list",
                params={
                    "project_id": project_name,  # API实际需要project_id参数
                    "tag_id": tag_id,
                    "current": current,
                    "pageSize": page_size
                },
                headers=_common_headers(),
                timeout=120  # 增加超时到120秒
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"Error fetching datasets: {str(e)}")
            raise HTTPException(status_code=500, detail=f"获取数据集列表失败: {str(e)}")


@router.get("/dataset/quality-report")
async def get_dataset_quality_report(
    project_name: str = Query(..., description="项目名称/项目ID"),
    dataset_name: str = Query(..., description="数据集名称"),
    tag_name: str = Query(None, description="Tag名称")
):
    """
    获取数据集质检报告

    Args:
        project_name: 项目名称或项目ID
        dataset_name: 数据集名称
        tag_name: Tag名称（可选）

    Returns:
        质检报告详情
    """
    async with httpx.AsyncClient(timeout=60, cookies=UUAP_COOKIES) as client:
        try:
            # 构建请求参数
            params = {
                "project_id": project_name,  # 数据平台API使用project_id参数
                "dataset_name": dataset_name
            }
            if tag_name:
                params["tag_name"] = tag_name

            resp = await client.get(
                f"{DATA_PLATFORM_BASE}/data/dataset/quality/test",
                params=params,
                timeout=30
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"Error fetching quality report: {str(e)}")
            raise HTTPException(status_code=500, detail=f"获取质检报告失败: {str(e)}")


@router.post("/dataset/preview")
async def preview_dataset(request: Request):
    """
    预览数据集样本

    Body:
        bos_path: BOS 路径
        limit: 预览条数(默认20,最大100)

    Returns:
        数据样本列表
    """
    body = await request.json()
    bos_path = body.get("bos_path", "")
    limit = min(body.get("limit", 20), 100)

    # 调用现有的 /api/delivery/sample-preview 接口
    async with httpx.AsyncClient(timeout=60, cookies=UUAP_COOKIES) as client:
        try:
            resp = await client.post(
                "http://localhost:8888/api/delivery/sample-preview",
                json={"bos_path": bos_path, "limit": limit},
                timeout=30
            )
            return resp.json()
        except Exception as e:
            logger.error(f"Error previewing dataset: {str(e)}")
            raise HTTPException(status_code=500, detail=f"预览数据失败: {str(e)}")


@router.get("/dataset/download")
async def download_dataset(
    project_name: str = Query(..., description="项目名称"),
    dataset_name: str = Query(..., description="数据集名称"),
    download_type: str = Query("sample", description="下载类型: sample(抽样) 或 full(全量)")
):
    """
    生成数据集下载链接

    Args:
        project_name: 项目名称
        dataset_name: 数据集名称
        download_type: 下载类型(sample/full)

    Returns:
        下载链接信息
    """
    async with httpx.AsyncClient(timeout=60, cookies=UUAP_COOKIES) as client:
        try:
            resp = await client.get(
                f"{DATA_PLATFORM_BASE}/data/dataset/download",
                params={
                    "project_name": project_name,
                    "dataset_name": dataset_name,
                    "type": download_type
                },
                timeout=30
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"Error generating download link: {str(e)}")
            raise HTTPException(status_code=500, detail=f"生成下载链接失败: {str(e)}")
