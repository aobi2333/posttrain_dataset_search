#!/bin/bash

# 后训练查询API测试脚本
# 用于测试API连接和数据获取

echo "========================================="
echo "后训练查询API测试"
echo "========================================="
echo ""

# 测试服务器是否运行
echo "1. 测试服务器连接..."
curl -s http://localhost:8888/api/post-train/projects | jq '.' || echo "❌ 服务器未响应，请确保运行: uvicorn app.main:app --host 0.0.0.0 --port 8888 --reload"
echo ""

# 测试获取Tag列表 (以eb5_data_sft_all为例)
echo "2. 测试获取Tag列表 (eb5_data_sft_all)..."
curl -s "http://localhost:8888/api/post-train/tags?project_name=eb5_data_sft_all" | jq '.data | length' || echo "❌ 获取Tag列表失败"
echo ""

# 如果需要测试特定Tag的数据集，需要先知道tag_id
echo "3. 获取第一个Tag的详细信息..."
TAG_INFO=$(curl -s "http://localhost:8888/api/post-train/tags?project_name=eb5_data_sft_all" | jq -r '.data[0] | "\(.id // .tag_id),\(.tag_name // .name)"')
echo "Tag信息: $TAG_INFO"
echo ""

if [ ! -z "$TAG_INFO" ] && [ "$TAG_INFO" != "null,null" ]; then
    TAG_ID=$(echo $TAG_INFO | cut -d',' -f1)
    TAG_NAME=$(echo $TAG_INFO | cut -d',' -f2)

    echo "4. 测试获取数据集列表 (tag_id=$TAG_ID)..."
    curl -s "http://localhost:8888/api/post-train/datasets?project_name=eb5_data_sft_all&tag_id=${TAG_ID}&current=1&page_size=5" | jq '.data.list | length' || echo "❌ 获取数据集列表失败"
else
    echo "4. ⚠️  未找到可用的Tag，跳过数据集测试"
fi

echo ""
echo "========================================="
echo "测试完成"
echo "========================================="
