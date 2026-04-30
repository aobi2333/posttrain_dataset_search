/* ===================== 训练类型切换和后训练查询逻辑 ===================== */

// 更新后训练数据的Profile信息
function updatePostTrainProfile() {
    if (!currentData || currentData.length === 0) return;

    let totalRows = 0;
    let totalTokens = 0;
    let datasetCount = currentData.length;
    let specialCount = 0;

    // 优先使用聚合信息（如果有）
    if (window._postTrainAggInfo) {
        const aggInfo = window._postTrainAggInfo;
        totalRows = aggInfo.data_count || 0;
        totalTokens = aggInfo.token_count || 0;
        datasetCount = aggInfo.dataset_count || currentData.length;
        specialCount = aggInfo.special_tag_count || 0;
    } else {
        // 否则从数据集列表计算
        currentData.forEach(ds => {
            totalRows += ds.final_row || 0;
            totalTokens += ds.final_token || 0;
        });
        // 计算专项数量（去重）
        const specialSet = new Set();
        currentData.forEach(ds => {
            const special = ds.special_ability || ds._special_project_name;
            if (special && special !== '-') {
                specialSet.add(special);
            }
        });
        specialCount = specialSet.size;
    }

    // 更新基本统计卡片
    document.getElementById('pfTotalRows').textContent = formatNumberCN(totalRows);
    document.getElementById('pfTotalTokens').textContent = totalTokens > 0 ? formatNumberCN(totalTokens) : '-';
    document.getElementById('pfDatasetCount').textContent = datasetCount;
    document.getElementById('pfSpecialCount').textContent = specialCount;

    // 更新子标题
    document.getElementById('pfRowsSub').textContent = totalRows > 0 ? `聚合自所有专项Tag的数据集` : '';
    document.getElementById('pfTokensSub').textContent = '';
    document.getElementById('pfDatasetSub').textContent = `共 ${datasetCount} 个数据集`;
    document.getElementById('pfSpecialSub').textContent = specialCount > 0 ? `涉及 ${specialCount} 个专项` : '';

    // 更新画像分布的 tabs（后训练专用维度）
    const tabsBar = document.querySelector('.profile-tabs-bar');
    if (tabsBar) {
        tabsBar.innerHTML = `
            <div class="profile-tab active" data-dim="overall">整体数据分布</div>
            <div class="profile-tab" data-dim="round">轮次信息统计</div>
            <div class="profile-tab" data-dim="length">长度信息统计</div>
            <div class="profile-tab" data-dim="language">语种分布统计</div>
            <div class="profile-tab" data-dim="multimodal">多模信息统计</div>
            <div class="profile-tab" data-dim="diversity">数据多样性</div>
            <div class="profile-tab" data-dim="quality">基础质检指标</div>
            <div class="profile-tab" data-dim="tags">标签体系统计</div>
        `;
    }

    // 暂不显示画像分布（后续可扩展）
    const tabContent = document.getElementById('profileTabContent');
    if (tabContent) {
        tabContent.innerHTML = `
            <div class="profile-empty">
                后训练画像信息开发中，当前信息可参考sugar报表<br>
                <a href="https://sugar.baidu-int.com/group/dataeng/report/r_1013e-6qgfdzy8-kx8ld8?__scp__=Baidu&conditions=%7B%22projecttag_id%22%3A%221363_20239018%22%2C%22base_projecttag_id%22%3A%220%22%7D"
                   target="_blank"
                   style="color:var(--brand-300);text-decoration:none;margin-top:8px;display:inline-block;">
                    查看Sugar报表 →
                </a>
            </div>
        `;
    }
}

// 格式化数字（中文K/M/B）
function formatNumberCN(num) {
    if (num >= 1e8) return (num / 1e8).toFixed(2) + '亿';
    if (num >= 1e4) return (num / 1e4).toFixed(2) + '万';
    return num.toLocaleString('zh-CN');
}

// 保存原始表头和原始画像 tabs
let _originalTableHeader = null;
let _originalProfileTabs = null;
// 标记是否为后训练模式（挂载到window对象，供分页等全局函数使用）
window._isPostTrainMode = false;

// 设置后训练专用表头和画像tabs
function setPostTrainTableHeader() {
    const thead = document.querySelector('#tableSection thead tr');
    if (!thead) return;

    // 第一次调用时保存原表头
    if (!_originalTableHeader) {
        _originalTableHeader = thead.innerHTML;
    }

    // 第一次调用时保存原始画像 tabs
    const tabsBar = document.querySelector('.profile-tabs-bar');
    if (tabsBar && !_originalProfileTabs) {
        _originalProfileTabs = tabsBar.innerHTML;
    }

    window._isPostTrainMode = true;

    // 后训练表头：数据集名称 | 专项 | 数据条数 | 数据token | 实际参与训练数量 | 实际参与训练token | 质检合格率 | RD负责人 | 更新时间 | 操作
    thead.innerHTML = `
        <th style="width:30px"></th>
        <th>数据集名称</th>
        <th>
            <div class="th-cell">
                专项
                <span class="filter-icon" onclick="togglePostTrainFilter(event,'pt_fd_special')">
                    <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                        <path d="M1.5 2h13a.5.5 0 0 1 .4.8L10 9.5V14a.5.5 0 0 1-.76.43l-2.5-1.5A.5.5 0 0 1 6.5 12.5V9.5L1.1 2.8A.5.5 0 0 1 1.5 2z"/>
                    </svg>
                    <div class="filter-dropdown" id="pt_fd_special"></div>
                </span>
            </div>
        </th>
        <th style="text-align:right;min-width:120px">数据条数</th>
        <th style="text-align:right">数据token</th>
        <th style="text-align:right">实际参与训练数量</th>
        <th style="text-align:right">实际参与训练token</th>
        <th>质检合格率</th>
        <th>RD负责人</th>
        <th style="min-width:160px">更新时间</th>
        <th style="text-align:center">操作</th>
    `;
}

// 恢复原始表头和画像tabs
function restoreOriginalTableHeader() {
    const thead = document.querySelector('#tableSection thead tr');
    if (thead && _originalTableHeader) {
        thead.innerHTML = _originalTableHeader;
    }

    const tabsBar = document.querySelector('.profile-tabs-bar');
    if (tabsBar && _originalProfileTabs) {
        tabsBar.innerHTML = _originalProfileTabs;
    }

    window._isPostTrainMode = false;
}

// 渲染后训练表格行
function renderPostTrainTableRow(item, fi, hasChildren) {
    // 构建数据集详情URL
    // 格式: /project/eb5/analysis/{project_id}/{dataset_name}?tag_name={tag_name}&multi_modal={multi_modal}&dataset_type={dataset_type}
    const projectId = item._special_project_id || '';
    const datasetName = item.dataset_name || '';
    const tagName = item._special_tag_name || '';
    const multiModal = item.multi_modal ? 'true' : 'false';
    const datasetType = item._dataset_type || 'SFT';  // 使用数据集类型，默认SFT
    const datasetDetailUrl = `http://data.yiyan.baidu-int.com/project/eb5/analysis/${projectId}/${encodeURIComponent(datasetName)}?tag_name=${encodeURIComponent(tagName)}&multi_modal=${multiModal}&dataset_type=${datasetType}`;

    // 构建质检报告URL
    // 格式: /project/quality/{project_id}/{dataset_name}?tag_name={tag_name}&table_type=tags&del_consume={del_consume}&join_aboard_plan=&is_review=
    const delConsume = item.del_consume || '';
    const qcReportUrl = `http://data.yiyan.baidu-int.com/project/quality/${projectId}/${encodeURIComponent(datasetName)}?tag_name=${encodeURIComponent(tagName)}&table_type=tags&del_consume=${delConsume}&join_aboard_plan=&is_review=`;

    return `
        <td>${hasChildren ? `<button class="expand-btn" onclick="toggleExpand(${fi})">&#9654;</button>` : ''}</td>
        <td>${esc(item.corpus_name || '')}${hasChildren ? ` <span class="child-count-badge" onclick="toggleExpand(${fi})">${item.children.length}个子集 &#9654;</span>` : ''}</td>
        <td>${esc(item.special_ability || '-')}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums">${formatNumberCN(item.final_row || 0)}</td>
        <td style="text-align:right;color:var(--text-tertiary)">-</td>
        <td style="text-align:right;color:var(--text-tertiary)">-</td>
        <td style="text-align:right;color:var(--text-tertiary)">-</td>
        <td>${renderQuality(item.quality_rate)}</td>
        <td>${esc(item.rd_owner || '-')}</td>
        <td style="font-size:12px">${esc(item.produce_time || '-')}</td>
        <td style="text-align:center">
            <div class="action-group">
                <a href="${datasetDetailUrl}" target="_blank" class="action-btn" title="查看数据集详情">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>
                    详情
                </a>
                <a href="${qcReportUrl}" target="_blank" class="action-btn" title="查看质检报告">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M5 6h6M5 9h6M5 12h4"/></svg>
                    质检
                </a>
                <button class="action-btn" disabled style="opacity:0.4;cursor:not-allowed" title="抽样下载暂不可用">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 11v2.5h12V11M8 2v8m-3-3l3 3 3-3"/></svg>
                    抽样
                </button>
                <button class="action-btn" disabled style="opacity:0.4;cursor:not-allowed" title="全量下载暂不可用">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 11v2.5h12V11M8 2v8m-3-3l3 3 3-3"/></svg>
                    全量
                </button>
            </div>
        </td>
    `;
}

// Helper functions (需要从主页面JS中复制)
function esc(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderQuality(rate) {
    if (rate === '-' || rate === null || rate === undefined) return '-';
    const num = parseFloat(rate);
    if (isNaN(num)) return '-';
    let cls = 'quality-good';
    if (num < 95) cls = 'quality-warn';
    if (num < 90) cls = 'quality-bad';
    return `<span class="${cls}">${num.toFixed(1)}%</span>`;
}

/**
 * 批量获取数据集的质检报告并更新质检合格率
 * @param {Array} datasets - 数据集数组
 */
async function fetchQualityReportsForDatasets(datasets) {
    if (!datasets || datasets.length === 0) {
        return;
    }

    console.log(`开始为 ${datasets.length} 个数据集获取质检报告...`);

    // 并发获取质检报告，限制并发数为10
    const concurrencyLimit = 10;
    let completed = 0;

    for (let i = 0; i < datasets.length; i += concurrencyLimit) {
        const batch = datasets.slice(i, i + concurrencyLimit);
        const promises = batch.map(async (ds) => {
            try {
                const projectName = ds._special_project_id || ds.release_no;
                const datasetName = ds.dataset_name;
                const tagName = ds._special_tag_name || '';

                if (!projectName || !datasetName) {
                    console.warn(`数据集缺少必要字段:`, ds);
                    return;
                }

                // 构建API URL，包含tag_name参数
                let apiUrl = `/api/post-train/dataset/quality-report?project_name=${encodeURIComponent(projectName)}&dataset_name=${encodeURIComponent(datasetName)}`;
                if (tagName) {
                    apiUrl += `&tag_name=${encodeURIComponent(tagName)}`;
                }

                const response = await fetch(apiUrl);

                if (!response.ok) {
                    console.warn(`获取质检报告失败 [${projectName}/${datasetName}]: ${response.status}`);
                    return;
                }

                const result = await response.json();

                if (result.code === 0 && result.data) {
                    // 从质检报告中提取合格数据占比
                    const qualityData = result.data;

                    let passRate = null;

                    // 优先方式: 从 statistics.qualified_percent 获取（0-1之间的比例值，需要乘以100）
                    if (qualityData.statistics?.qualified_percent !== undefined && qualityData.statistics.qualified_percent !== null) {
                        passRate = (parseFloat(qualityData.statistics.qualified_percent) * 100).toFixed(1);
                        console.log(`✓ ${datasetName}: 质检合格率 ${passRate}% (from statistics.qualified_percent)`);
                    }
                    // 方式1: 如果有 pass_count 和 total_count
                    else if (qualityData.pass_count !== undefined && qualityData.total_count > 0) {
                        passRate = (qualityData.pass_count / qualityData.total_count * 100).toFixed(1);
                    }
                    // 方式2: 如果有 pass_rate 字段
                    else if (qualityData.pass_rate !== undefined) {
                        passRate = (qualityData.pass_rate * 100).toFixed(1);
                    }
                    // 方式3: 如果有 qualified_count 和 total_count
                    else if (qualityData.qualified_count !== undefined && qualityData.total_count > 0) {
                        passRate = (qualityData.qualified_count / qualityData.total_count * 100).toFixed(1);
                    }
                    // 方式4: 如果有 qualified_rate
                    else if (qualityData.qualified_rate !== undefined) {
                        passRate = (qualityData.qualified_rate * 100).toFixed(1);
                    }
                    // 方式5: 检查嵌套结构
                    else if (qualityData.summary) {
                        const summary = qualityData.summary;
                        if (summary.pass_count !== undefined && summary.total_count > 0) {
                            passRate = (summary.pass_count / summary.total_count * 100).toFixed(1);
                        } else if (summary.pass_rate !== undefined) {
                            passRate = (summary.pass_rate * 100).toFixed(1);
                        } else if (summary.qualified_percent !== undefined) {
                            passRate = (parseFloat(summary.qualified_percent) * 100).toFixed(1);
                        }
                    }

                    if (passRate !== null) {
                        ds.quality_rate = passRate;
                        if (qualityData.statistics?.qualified_percent === undefined) {
                            console.log(`✓ ${datasetName}: 质检合格率 ${passRate}% (fallback method)`);
                        }
                    } else {
                        console.warn(`质检报告数据结构未知 [${datasetName}]:`, qualityData);
                    }
                } else {
                    console.warn(`质检报告返回错误 [${datasetName}]:`, result.message);
                }
            } catch (error) {
                console.error(`获取质检报告异常 [${ds.dataset_name}]:`, error);
            }
        });

        await Promise.all(promises);
        completed += batch.length;
        console.log(`质检报告获取进度: ${completed}/${datasets.length}`);
    }

    console.log('所有质检报告获取完成');
}

function onTrainingTypeChange() {
    const trainingType = document.getElementById('trainingTypeSelect').value;
    const pretrainFilter = document.getElementById('pretrain-midtrain-filter');
    const posttrainFilter = document.getElementById('posttrain-filter');

    // 重置页码和后训练筛选状态
    window.currentPage = 1;
    if (window.postTrainActiveFilters) {
        window.postTrainActiveFilters.special.clear();
        document.querySelectorAll('.filter-icon.active').forEach(el => el.classList.remove('active'));
    }

    // 隐藏所有筛选区域
    pretrainFilter.style.display = 'none';
    posttrainFilter.style.display = 'none';

    // 隐藏数据展示区域
    document.getElementById('profileSection').style.display = 'none';
    document.getElementById('tableSection').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';

    // 根据选择显示对应的筛选区域和恢复表头
    if (trainingType === 'pretrain' || trainingType === 'midtrain') {
        pretrainFilter.style.display = 'block';
        restoreOriginalTableHeader(); // 恢复预训练/中训练的表头
    } else if (trainingType === 'posttrain') {
        posttrainFilter.style.display = 'block';
        // 后训练的表头会在查询成功后设置
    }
}

async function onPostTrainProjectChange() {
    const projectSelect = document.getElementById('postTrainProjectSelect');
    const tagSelect = document.getElementById('postTrainTagSelect');
    const queryBtn = document.getElementById('btnPostTrainQuery');

    const projectId = projectSelect.value;

    if (!projectId) {
        tagSelect.disabled = true;
        tagSelect.innerHTML = '<option value="">请先选择上车Tag</option>';
        queryBtn.disabled = true;
        return;
    }

    tagSelect.disabled = true;
    tagSelect.innerHTML = '<option value="">加载中...</option>';

    try {
        const response = await fetch(`/api/post-train/tags?project_name=${encodeURIComponent(projectId)}`);

        // 检查HTTP响应状态
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.code === 0 && result.data) {
            const tags = Array.isArray(result.data) ? result.data : result.data.datas || result.data.list || [];
            // 筛选出上车Tag (join_aboard_plan === true 或有 plan_id)
            const aboardTags = tags.filter(tag => tag.join_aboard_plan === true || tag.plan_id);

            if (aboardTags.length > 0) {
                tagSelect.innerHTML = '<option value="">请选择上车Tag</option>';
                aboardTags.forEach(tag => {
                    const option = document.createElement('option');
                    // 存储tag_id和tag_name
                    option.value = JSON.stringify({
                        tag_id: tag.tag_id || tag.id,
                        tag_name: tag.tag_name || tag.name
                    });
                    option.textContent = `${tag.tag_name || tag.name}${tag.create_time ? ' (' + new Date(tag.create_time).toLocaleDateString() + ')' : ''}`;
                    tagSelect.appendChild(option);
                });
                tagSelect.disabled = false;
                // 查询按钮初始禁用，等用户选择Tag后由change事件启用
                queryBtn.disabled = true;
            } else {
                tagSelect.innerHTML = '<option value="">该项目暂无上车Tag</option>';
                tagSelect.disabled = true;
                queryBtn.disabled = true;
                showToast('该项目暂无上车Tag', 'info');
            }
        } else {
            // 接口返回错误码，使用Mock数据
            console.warn('接口返回错误，使用Mock Tag列表:', result.message);
            showToast('接口返回失败，展示Mock Tag列表', 'warning');

            const mockTags = generateMockPostTrainTags(projectId);

            if (mockTags.length > 0) {
                tagSelect.innerHTML = '<option value="">请选择上车Tag（Mock数据）</option>';
                mockTags.forEach(tag => {
                    const option = document.createElement('option');
                    option.value = JSON.stringify({
                        tag_id: tag.tag_id || tag.id,
                        tag_name: tag.tag_name || tag.name
                    });
                    option.textContent = `${tag.tag_name || tag.name}${tag.create_time ? ' (' + new Date(tag.create_time).toLocaleDateString() + ')' : ''} [Mock]`;
                    tagSelect.appendChild(option);
                });
                tagSelect.disabled = false;
                // 查询按钮初始禁用，等用户选择Tag后由change事件启用
                queryBtn.disabled = true;
            } else {
                tagSelect.innerHTML = '<option value="">获取Tag列表失败</option>';
                tagSelect.disabled = true;
                queryBtn.disabled = true;
            }
        }
    } catch (error) {
        console.error('获取Tag列表失败:', error);

        // 接口失败时使用Mock数据
        console.log('使用Mock Tag列表数据');
        showToast('接口请求失败，展示Mock Tag列表', 'warning');

        const mockTags = generateMockPostTrainTags(projectId);

        if (mockTags.length > 0) {
            tagSelect.innerHTML = '<option value="">请选择上车Tag（Mock数据）</option>';
            mockTags.forEach(tag => {
                const option = document.createElement('option');
                option.value = JSON.stringify({
                    tag_id: tag.tag_id || tag.id,
                    tag_name: tag.tag_name || tag.name
                });
                option.textContent = `${tag.tag_name || tag.name}${tag.create_time ? ' (' + new Date(tag.create_time).toLocaleDateString() + ')' : ''} [Mock]`;
                tagSelect.appendChild(option);
            });
            tagSelect.disabled = false;
            // 查询按钮初始禁用，等用户选择Tag后由change事件启用
            queryBtn.disabled = true;
        } else {
            tagSelect.innerHTML = '<option value="">获取Tag列表失败</option>';
            tagSelect.disabled = true;
            queryBtn.disabled = true;
        }
    }

    // 注意：不要在这里无条件禁用查询按钮
    // queryBtn 的状态应该由 tagSelect 的 change 事件控制
}

document.addEventListener('DOMContentLoaded', () => {
    const tagSelect = document.getElementById('postTrainTagSelect');
    const queryBtn = document.getElementById('btnPostTrainQuery');

    if (tagSelect && queryBtn) {
        tagSelect.addEventListener('change', () => {
            queryBtn.disabled = !tagSelect.value;
        });

        queryBtn.addEventListener('click', async () => {
            const projectId = document.getElementById('postTrainProjectSelect').value;
            const tagSelectValue = tagSelect.value;

            if (!projectId || !tagSelectValue) {
                showToast('请选择上车Tag', 'error');
                return;
            }

            // 解析tag信息
            const tagInfo = JSON.parse(tagSelectValue);
            const tagId = tagInfo.tag_id;
            const tagName = tagInfo.tag_name;

            // 开始查询：先隐藏旧数据，显示loading
            document.getElementById('profileSection').style.display = 'none';
            document.getElementById('tableSection').style.display = 'none';
            showLoading(true);

            // 重置筛选状态
            postTrainActiveFilters.special.clear();
            document.querySelectorAll('.filter-icon.active').forEach(el => el.classList.remove('active'));

            try {
                // 直接通过project_id和tag_name查询所有数据集
                console.log(`查询参数: project_id=${projectId}, tag_name=${tagName}`);

                const response = await fetch(`/api/post-train/tag-datasets?project_id=${encodeURIComponent(projectId)}&tag_name=${encodeURIComponent(tagName)}`);

                // 检查响应状态
                if (!response.ok) {
                    throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
                }

                const result = await response.json();

                console.log('========== API返回完整结果 ==========');
                console.log('完整结果:', result);
                console.log('数据集数量:', result.data?.datasets?.length);

                if (result.data?.datasets?.length > 0) {
                    console.log('========== 前3个数据集原始数据 ==========');
                    result.data.datasets.slice(0, 3).forEach((ds, i) => {
                        console.log(`数据集 ${i}:`, {
                            name: ds.name,
                            dataset_name: ds.dataset_name,
                            _special_project_id: ds._special_project_id,
                            _special_project_name: ds._special_project_name,
                            _special_tag_name: ds._special_tag_name,
                            ref_project_name: ds.ref_project_name,
                            ref_project_id: ds.ref_project_id
                        });
                    });
                    console.log('=====================================');

                    // 统计所有唯一的专项名称（从原始数据）
                    const rawSpecials = new Set();
                    result.data.datasets.forEach(ds => {
                        const special = ds._special_project_name || ds.ref_project_name;
                        if (special && special !== '-') {
                            rawSpecials.add(special);
                        }
                    });
                    console.log('原始数据中的唯一专项数量:', rawSpecials.size);
                    console.log('原始数据中的专项列表:', Array.from(rawSpecials).sort());
                }

                if (result.code === 0 && result.data) {
                    const datasets = result.data.datasets || [];
                    const summary = result.data.summary || {};
                    const allSpecialProjects = result.data.all_special_projects || [];  // 获取完整专项列表

                    console.log('========== 后端返回的完整专项列表 ==========');
                    console.log('所有专项数量:', allSpecialProjects.length);
                    console.log('专项详情:', allSpecialProjects);
                    console.log('=========================================');

                    // 保存完整专项列表到全局变量，供筛选框使用
                    window._allSpecialProjects = allSpecialProjects;

                    // 转换数据格式（保留原始数据集对象的所有字段用于URL构建）
                    currentData = datasets.map(ds => ({
                        // 原始字段（用于URL构建）
                        _raw: ds,
                        _special_project_id: ds._special_project_id,
                        _special_project_name: ds._special_project_name,
                        _special_tag_name: ds._special_tag_name,
                        _dataset_type: ds._dataset_type || 'SFT',  // 数据集类型，默认SFT
                        dataset_name: ds.name,
                        dataset_id: ds.id,
                        del_consume: ds.del_consume,
                        multi_modal: ds.multi_modal,

                        // 展示字段
                        deliver_no: ds.id || ds.dataset_id || '-',
                        release_no: ds.project_name || '-',
                        corpus_name: ds.dataset_name || ds.name || '-',
                        special_ability: ds._special_project_name || ds.ref_project_name || '-',
                        data_model: '后训练',
                        source_info: ds._special_tag_name || '-',
                        final_row: ds.amount || ds.data_count || 0,
                        final_text_token: 0,
                        final_token: ds.token_count || 0,
                        avg_token: (ds.token_count && ds.amount) ? Math.floor(ds.token_count / ds.amount) : 0,
                        median_token: 0,
                        quality_rate: ds.quality_rate ? (ds.quality_rate * 100).toFixed(1) : '-',
                        quality_check: ds.qc_fatal_tag ? 0 : 1,
                        icafe_no: '-',
                        produce_time: ds.update_time ? new Date(ds.update_time).toLocaleString('zh-CN') : '-',
                        deliver_version: tagName,
                        final_sample_path: ds.export_path || ds.bos_path || '',
                        disused: 0,
                        disuse_revoke_reason: '',
                        rd_owner: ds.updater_name || ds.creator_name || '-',
                        children: []
                    }));

                    console.log('转换后的数据:', currentData);
                    console.log('聚合统计:', summary);
                    console.log('专项Tag数量字段:', {
                        special_tag_count: summary.special_tag_count,
                        special_count: summary.special_count,
                        special_project_count: summary.special_project_count
                    });

                    // 计算实际的专项数量（从数据集中提取唯一专项）
                    const actualSpecialSet = new Set();
                    const specialDistribution = {};
                    currentData.forEach(ds => {
                        const special = ds.special_ability;
                        if (special && special !== '-') {
                            actualSpecialSet.add(special);
                            specialDistribution[special] = (specialDistribution[special] || 0) + 1;
                        }
                    });
                    const actualSpecialCount = actualSpecialSet.size;
                    console.log('从数据中计算的专项数量:', actualSpecialCount);
                    console.log('各专项的数据集数量分布:', specialDistribution);
                    console.log('所有专项列表:', Array.from(actualSpecialSet).sort());

                    // 保存聚合信息（优先使用API返回的，否则使用计算的）
                    window._postTrainAggInfo = {
                        data_count: summary.total_data_count || 0,
                        dataset_count: summary.total_dataset_count || 0,
                        special_tag_count: summary.special_tag_count || summary.special_count || summary.special_project_count || actualSpecialCount
                    };

                    // 批量获取质检报告中的合格数据占比
                    console.log('开始批量获取质检报告...');
                    showToast('正在获取质检报告...', 'info');
                    await fetchQualityReportsForDatasets(currentData);
                    console.log('质检报告获取完成');

                    filteredData = [...currentData];
                    window.currentPage = 1;

                    // 隐藏空状态
                    document.getElementById('emptyState').style.display = 'none';

                    // 显示Profile和表格区域
                    document.getElementById('profileSection').style.display = 'block';
                    document.getElementById('tableSection').style.display = 'block';

                    // 切换为后训练专用表头
                    setPostTrainTableHeader();

                    // 填充专项筛选下拉框（表格列筛选）
                    populatePostTrainFilterDropdown();

                    // 更新统计信息
                    updatePostTrainProfile();

                    // 渲染表格
                    renderPostTrainTable(filteredData);

                    showToast(`查询成功，共 ${currentData.length} 个数据集，质检报告已加载`, 'success');
                } else {
                    // 接口返回错误码时也使用Mock数据
                    console.warn('接口返回错误，使用Mock数据:', result.message);
                    showToast('接口返回失败，展示Mock数据', 'warning');

                    // 生成mock数据
                    currentData = generateMockPostTrainData(projectId, tagName);

                    console.log('使用Mock数据:', currentData);

                    // 保存聚合信息
                    window._postTrainAggInfo = {
                        data_count: currentData.reduce((sum, ds) => sum + ds.final_row, 0),
                        dataset_count: currentData.length,
                        special_tag_count: new Set(currentData.map(ds => ds.special_ability)).size
                    };

                    filteredData = [...currentData];
                    window.currentPage = 1;

                    // 隐藏空状态
                    document.getElementById('emptyState').style.display = 'none';

                    // 显示Profile和表格区域
                    document.getElementById('profileSection').style.display = 'block';
                    document.getElementById('tableSection').style.display = 'block';

                    // 切换为后训练专用表头
                    setPostTrainTableHeader();

                    // 填充专项筛选下拉框（表格列筛选）
                    populatePostTrainFilterDropdown();

                    // 更新统计信息
                    updatePostTrainProfile();

                    // 渲染表格
                    renderPostTrainTable(filteredData);
                }
            } catch (error) {
                console.error('查询失败:', error);

                // 接口失败时展示mock数据
                showToast('接口请求失败，展示Mock数据', 'warning');

                // 生成mock数据
                currentData = generateMockPostTrainData(projectId, tagName);

                console.log('使用Mock数据:', currentData);

                // 保存聚合信息
                window._postTrainAggInfo = {
                    data_count: currentData.reduce((sum, ds) => sum + ds.final_row, 0),
                    dataset_count: currentData.length,
                    special_tag_count: new Set(currentData.map(ds => ds.special_ability)).size
                };

                filteredData = [...currentData];
                window.currentPage = 1;

                // 隐藏空状态
                document.getElementById('emptyState').style.display = 'none';

                // 显示Profile和表格区域
                document.getElementById('profileSection').style.display = 'block';
                document.getElementById('tableSection').style.display = 'block';

                // 切换为后训练专用表头
                setPostTrainTableHeader();

                // 填充专项筛选下拉框（表格列筛选）
                populatePostTrainFilterDropdown();

                // 更新统计信息
                updatePostTrainProfile();

                // 渲染表格
                renderPostTrainTable(filteredData);
            } finally {
                showLoading(false);
            }
        });
    }
});

// 渲染后训练表格
function renderPostTrainTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    // 获取分页参数（使用全局变量或默认值）
    const PAGE_SIZE = window.PAGE_SIZE || 20;
    const currentPageNum = window.currentPage || 1;

    const total = data.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const start = (currentPageNum - 1) * PAGE_SIZE;
    const pageData = data.slice(start, start + PAGE_SIZE);

    document.getElementById('tableCount').textContent = `共 ${formatNumberCN(total)} 条`;

    pageData.forEach((item, i) => {
        const fi = start + i;
        const hasChildren = item.children && item.children.length > 0;
        const tr = document.createElement('tr');
        tr.dataset.idx = fi;
        tr.innerHTML = renderPostTrainTableRow(item, fi, hasChildren);
        tbody.appendChild(tr);
    });

    // 渲染分页（调用主页面的分页函数，传递正确的参数）
    if (typeof renderPagination === 'function') {
        renderPagination(total, totalPages);
    }
}

// ============= 后训练表格列筛选功能 =============

// 后训练筛选状态（挂载到window全局对象，确保跨函数可访问）
window.postTrainActiveFilters = {
    special: new Set()
};
// 为了兼容性，也保留局部引用
let postTrainActiveFilters = window.postTrainActiveFilters;

// 全局变量：存储当前正在更新位置的定时器
let _updatePositionTimer = null;

// 全局函数：更新所有显示中的筛选框位置
function updateFilterDropdownPosition() {
    document.querySelectorAll('.filter-dropdown.show').forEach(dd => {
        const icon = dd.parentElement;
        if (icon) {
            const rect = icon.getBoundingClientRect();
            dd.style.left = rect.left + 'px';
            dd.style.top = (rect.bottom + 4) + 'px';

            console.log('更新筛选框位置:', {
                id: dd.id,
                left: rect.left,
                top: rect.bottom + 4,
                iconRect: rect
            });
        }
    });
}

// 节流版本的位置更新函数（避免滚动时频繁调用）
function throttledUpdatePosition() {
    if (_updatePositionTimer) return;
    _updatePositionTimer = setTimeout(() => {
        updateFilterDropdownPosition();
        _updatePositionTimer = null;
    }, 16); // 约 60fps
}

// 切换后训练筛选下拉框（全局函数）
window.togglePostTrainFilter = function(event, id) {
    console.log('togglePostTrainFilter 被调用, id:', id);

    event.stopPropagation();
    const dd = document.getElementById(id);

    if (!dd) {
        console.error(`找不到筛选框元素: ${id}`);
        return;
    }

    const icon = dd.parentElement;
    console.log('筛选框元素:', dd, '父元素:', icon);

    // 关闭其他下拉框
    document.querySelectorAll('.filter-dropdown.show').forEach(d => {
        if (d.id !== id) d.classList.remove('show');
    });

    if (dd.classList.contains('show')) {
        dd.classList.remove('show');
        // 移除滚动监听
        window.removeEventListener('scroll', throttledUpdatePosition);
        document.querySelector('.table-wrap')?.removeEventListener('scroll', throttledUpdatePosition);
        console.log('关闭筛选框');
        return;
    }

    // 先添加 show class，再定位（因为 updateFilterDropdownPosition 只处理有 show class 的元素）
    dd.classList.add('show');

    // 定位下拉框
    const rect = icon.getBoundingClientRect();
    dd.style.left = rect.left + 'px';
    dd.style.top = (rect.bottom + 4) + 'px';

    console.log('打开筛选框, 位置:', {
        left: rect.left,
        top: rect.bottom + 4,
        iconRect: rect
    });
    console.log('筛选框HTML:', dd.innerHTML.substring(0, 200));
    console.log('筛选框计算样式:', {
        display: window.getComputedStyle(dd).display,
        position: window.getComputedStyle(dd).position,
        zIndex: window.getComputedStyle(dd).zIndex,
        visibility: window.getComputedStyle(dd).visibility,
        left: dd.style.left,
        top: dd.style.top
    });

    // 添加滚动监听（监听 window 和 table-wrap 两个滚动源）
    window.addEventListener('scroll', throttledUpdatePosition, { passive: true });
    const tableWrap = document.querySelector('.table-wrap');
    if (tableWrap) {
        tableWrap.addEventListener('scroll', throttledUpdatePosition, { passive: true });
    }
};

// 点击其他地方关闭筛选框
document.addEventListener('click', function(e) {
    // 如果点击的不是筛选图标和筛选框内部，关闭所有筛选框
    if (!e.target.closest('.filter-icon') && !e.target.closest('.filter-dropdown')) {
        document.querySelectorAll('.filter-dropdown.show').forEach(dd => {
            dd.classList.remove('show');
        });
        // 移除滚动监听
        window.removeEventListener('scroll', throttledUpdatePosition);
        document.querySelector('.table-wrap')?.removeEventListener('scroll', throttledUpdatePosition);
    }
});

// 填充后训练筛选下拉框
function populatePostTrainFilterDropdown() {
    if (!currentData || currentData.length === 0) {
        console.warn('populatePostTrainFilterDropdown: currentData 为空');
        return;
    }

    // 提取实际存在数据的专项名称
    const specials = new Set();
    const specialFieldStats = {
        special_ability: 0,
        _special_project_name: 0,
        ref_project_name: 0,
        none: 0
    };

    currentData.forEach((ds, index) => {
        let special = null;

        if (ds.special_ability && ds.special_ability !== '-') {
            special = ds.special_ability;
            specialFieldStats.special_ability++;
        } else if (ds._special_project_name && ds._special_project_name !== '-') {
            special = ds._special_project_name;
            specialFieldStats._special_project_name++;
        } else if (ds.ref_project_name && ds.ref_project_name !== '-') {
            special = ds.ref_project_name;
            specialFieldStats.ref_project_name++;
        } else {
            specialFieldStats.none++;
        }

        if (special) {
            specials.add(special);
        }

        // 打印前3个数据集的详细信息
        if (index < 3) {
            console.log(`数据集 ${index}:`, {
                corpus_name: ds.corpus_name,
                special_ability: ds.special_ability,
                _special_project_name: ds._special_project_name,
                ref_project_name: ds.ref_project_name
            });
        }
    });

    console.log('========== 专项筛选统计 ==========');
    console.log('总数据集数量:', currentData.length);
    console.log('字段使用统计:', specialFieldStats);
    console.log('实际有数据的专项数量:', specials.size);
    console.log('实际有数据的专项列表:', Array.from(specials).sort());

    // 构建专项列表和计数映射表
    let specialList = [];
    const specialCounts = {};

    // 检查是否有后端返回的完整专项列表
    if (window._allSpecialProjects && window._allSpecialProjects.length > 0) {
        console.log('使用后端返回的完整专项列表（包括无权限专项）');

        // 使用后端返回的所有专项
        window._allSpecialProjects.forEach(sp => {
            const projectName = sp.project_name;
            specialList.push(projectName);

            // 计算该专项的数据集数量
            const count = Array.from(currentData).filter(ds =>
                ds.special_ability === projectName ||
                ds._special_project_name === projectName ||
                ds.ref_project_name === projectName
            ).length;

            specialCounts[projectName] = count;
        });

        console.log('完整专项列表:', specialList);
        console.log('各专项数据集数量:', specialCounts);

        // 统计有权限和无权限的专项数量
        const hasDataCount = Object.values(specialCounts).filter(count => count > 0).length;
        const noDataCount = specialList.length - hasDataCount;
        console.log(`专项统计: 总计 ${specialList.length} 个, 有数据 ${hasDataCount} 个, 无权限 ${noDataCount} 个`);
    } else {
        console.log('后端未返回完整专项列表，使用实际有数据的专项');

        // 如果后端没有返回完整列表，则只显示有数据的专项
        specialList = Array.from(specials).sort();

        Array.from(specials).forEach(special => {
            specialCounts[special] = Array.from(currentData).filter(ds =>
                ds.special_ability === special ||
                ds._special_project_name === special ||
                ds.ref_project_name === special
            ).length;
        });
    }

    console.log('====================================');

    buildPostTrainFilterDropdown('pt_fd_special', 'special', specialList, specialCounts);
}

// 构建后训练筛选下拉框HTML
function buildPostTrainFilterDropdown(containerId, filterKey, values, specialCounts = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`筛选容器 ${containerId} 不存在`);
        return;
    }

    // 确保筛选状态对象存在
    if (!postTrainActiveFilters[filterKey]) {
        postTrainActiveFilters[filterKey] = new Set();
    }

    console.log(`构建筛选下拉框 ${containerId}, 筛选项数量: ${values.length}`);
    console.log('专项计数:', specialCounts);

    let html = `<input class="filter-search" placeholder="搜索..." oninput="filterPostTrainDropdownOptions(this,'${containerId}')">`;
    html += '<div class="filter-options">';

    if (values.length === 0) {
        html += '<div style="padding:12px;text-align:center;color:var(--text-tertiary);font-size:12px">暂无筛选项</div>';
    } else {
        values.forEach(v => {
            const checked = postTrainActiveFilters[filterKey].has(v) ? 'checked' : '';
            const escapedValue = esc(v);
            const count = specialCounts[v] || 0;
            const hasData = count > 0;

            // 如果没有数据，显示灰色并添加说明
            const style = hasData ? '' : 'opacity:0.5;';
            const countText = hasData ? ` (${count})` : ' (无权限)';

            // 使用 data 属性存储原始值，避免转义问题
            html += `<label data-val="${escapedValue.toLowerCase()}" data-original="${escapedValue}" style="${style}">
                <input type="checkbox" ${checked} ${hasData ? '' : 'disabled'} onchange="onPostTrainFilterCheckByData(this.parentElement, '${filterKey}', this.checked)">
                <span>${escapedValue}${countText}</span>
            </label>`;
        });
    }

    html += '</div>';
    container.innerHTML = html;
}

// 通过 data 属性获取值的筛选函数（避免转义问题）
window.onPostTrainFilterCheckByData = function(label, filterKey, checked) {
    const value = label.getAttribute('data-original');
    if (checked) {
        postTrainActiveFilters[filterKey].add(value);
    } else {
        postTrainActiveFilters[filterKey].delete(value);
    }
    applyPostTrainFilters();
};

// 筛选下拉框选项搜索（全局函数）
window.filterPostTrainDropdownOptions = function(input, containerId) {
    const val = input.value.toLowerCase();
    const container = document.getElementById(containerId);
    container.querySelectorAll('.filter-options label').forEach(label => {
        const dataVal = label.getAttribute('data-val');
        label.style.display = dataVal.includes(val) ? 'flex' : 'none';
    });
};

// 筛选复选框变更（全局函数）
window.onPostTrainFilterCheck = function(filterKey, value, checked) {
    if (checked) {
        postTrainActiveFilters[filterKey].add(value);
    } else {
        postTrainActiveFilters[filterKey].delete(value);
    }
    applyPostTrainFilters();
};

// 应用后训练筛选
function applyPostTrainFilters() {
    if (!currentData) return;

    let filtered = [...currentData];

    // 专项筛选
    if (postTrainActiveFilters.special.size > 0) {
        filtered = filtered.filter(item =>
            postTrainActiveFilters.special.has(item.special_ability)
        );
    }

    filteredData = filtered;

    // 更新筛选图标状态
    const specialIcon = document.querySelector('#pt_fd_special')?.parentElement;
    if (specialIcon) {
        if (postTrainActiveFilters.special.size > 0) {
            specialIcon.classList.add('active');
        } else {
            specialIcon.classList.remove('active');
        }
    }

    // 重置到第一页
    window.currentPage = 1;
    renderPostTrainTable(filteredData);
}

// 清除后训练筛选
function clearPostTrainFilters() {
    postTrainActiveFilters.special.clear();
    document.querySelectorAll('#pt_fd_special input[type=checkbox]').forEach(cb => cb.checked = false);
    document.querySelectorAll('.filter-icon.active').forEach(el => el.classList.remove('active'));
    applyPostTrainFilters();
}

// ============= Mock数据生成 =============

// 生成后训练Mock Tag列表
function generateMockPostTrainTags(projectId) {
    const tagCount = 5 + Math.floor(Math.random() * 5); // 5-10个Tag
    const tags = [];

    for (let i = 0; i < tagCount; i++) {
        const month = String(Math.floor(Math.random() * 3) + 3).padStart(2, '0'); // 03-05月
        const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
        const createTime = new Date(2026, parseInt(month) - 1, parseInt(day));

        tags.push({
            tag_id: `tag_${projectId}_${i + 1}`,
            tag_name: `26.${month}.${day}_Tag${i + 1}`,
            id: `tag_${projectId}_${i + 1}`,
            name: `26.${month}.${day}_Tag${i + 1}`,
            join_aboard_plan: true,
            plan_id: 1000 + i,
            create_time: createTime.getTime(),
            creator_name: ['张三', '李四', '王五'][Math.floor(Math.random() * 3)]
        });
    }

    // 按创建时间倒序排列
    return tags.sort((a, b) => b.create_time - a.create_time);
}

// 生成专项项目和Tag的Mock数据
function generateMockSpecialProjects(crossProjectId, tagName) {
    const specialProjects = [
        { id: 1279, name: 'eb5_data_sft_text_creation', display_name: '文本创作' },
        { id: 1280, name: 'eb5_data_sft_agent', display_name: 'Agent' },
        { id: 1281, name: 'eb5_data_sft_reasoning', display_name: '推理' },
        { id: 1282, name: 'eb5_data_sft_qa_deepsearch', display_name: '深度搜索问答' },
        { id: 1283, name: 'eb5_data_sft_deepsearch_gen', display_name: '深度搜索生成' },
        { id: 1284, name: 'eb5_data_sft_science', display_name: '科学' },
        { id: 1285, name: 'eb5_data_sft_code', display_name: '代码' },
        { id: 1286, name: 'eb5_data_sft_general_common', display_name: '通用常识' },
        { id: 1287, name: 'eb5_data_sft_general_business', display_name: '通用商务' },
        { id: 1288, name: 'eb5_data_sft_general_benchmark', display_name: '通用基准' },
        { id: 1289, name: 'eb5_data_sft_if', display_name: 'IF' }
    ];

    return specialProjects.map((sp, index) => {
        const tagIndex = Math.floor(Math.random() * 3) + 1;
        return {
            project_id: sp.id,
            project_name: sp.name,
            display_name: sp.display_name,
            tag_id: `${sp.name}_tag_${tagIndex}`,
            tag_name: `26.03.${20 + tagIndex}_Tag${tagIndex}`,
            dataset_count: Math.floor(Math.random() * 10) + 5,
            data_count: Math.floor(Math.random() * 100000) + 10000
        };
    });
}

// 生成后训练Mock数据集数据
function generateMockPostTrainData(projectId, tagName) {
    const specialProjects = [
        { id: 1279, name: 'eb5_data_sft_text_creation' },
        { id: 1280, name: 'eb5_data_sft_agent' },
        { id: 1281, name: 'eb5_data_sft_reasoning' },
        { id: 1282, name: 'eb5_data_sft_qa_deepsearch' },
        { id: 1283, name: 'eb5_data_sft_deepsearch_gen' },
        { id: 1284, name: 'eb5_data_sft_science' },
        { id: 1285, name: 'eb5_data_sft_code' },
        { id: 1286, name: 'eb5_data_sft_general_common' },
        { id: 1287, name: 'eb5_data_sft_general_business' },
        { id: 1288, name: 'eb5_data_sft_general_benchmark' },
        { id: 1289, name: 'eb5_data_sft_if' }
    ];

    const specialTags = [
        '0325_tag1', '0325_tag2', '0325_tag3',
        '26.03.25_Tag1', '26.03.25_Tag2', '26.03.25_Tag3'
    ];

    const rdOwners = ['张三', '李四', '王五', '赵六', '刘七', '陈八'];

    const mockData = [];
    const datasetCount = 15 + Math.floor(Math.random() * 10); // 15-25个数据集

    for (let i = 0; i < datasetCount; i++) {
        const special = specialProjects[Math.floor(Math.random() * specialProjects.length)];
        const tag = specialTags[Math.floor(Math.random() * specialTags.length)];
        const datasetName = `${special.name}_dataset_${i + 1}`;
        const amount = Math.floor(Math.random() * 500000) + 10000; // 10k-510k条数据
        const qualityRate = (85 + Math.random() * 15).toFixed(1); // 85%-100%
        const rdOwner = rdOwners[Math.floor(Math.random() * rdOwners.length)];

        // 根据项目ID推断数据集类型
        let datasetType = 'SFT';  // 默认SFT
        if (projectId === '1265') {
            datasetType = 'PPO';  // eb5_data_ppo_all
        }

        // 生成随机日期（最近3个月内）
        const now = new Date();
        const randomDays = Math.floor(Math.random() * 90);
        const updateTime = new Date(now.getTime() - randomDays * 24 * 60 * 60 * 1000);

        mockData.push({
            // 原始字段（用于URL构建）
            _special_project_id: special.id,
            _special_project_name: special.name,
            _special_tag_name: tag,
            _dataset_type: datasetType,  // 添加数据集类型
            dataset_name: datasetName,
            dataset_id: 1000 + i,
            del_consume: Math.floor(Math.random() * 100),
            multi_modal: Math.random() > 0.5,

            // 展示字段
            deliver_no: (1000 + i).toString(),
            release_no: projectId,
            corpus_name: datasetName,
            special_ability: special.name,
            data_model: '后训练',
            source_info: tag,
            final_row: amount,
            final_text_token: 0,
            final_token: 0,
            avg_token: 0,
            median_token: 0,
            quality_rate: qualityRate,
            quality_check: parseFloat(qualityRate) >= 90 ? 1 : 0,
            icafe_no: '-',
            produce_time: updateTime.toLocaleString('zh-CN'),
            deliver_version: tagName,
            final_sample_path: '',
            disused: 0,
            disuse_revoke_reason: '',
            rd_owner: rdOwner,
            children: []
        });
    }

    return mockData;
}
