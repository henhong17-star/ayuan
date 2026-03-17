/**
 * 餐车菜品验收与剩餐记录原型 - 逻辑脚本 (v3: 布局与交互优化)
 */

// 应用状态
const state = {
    currentMode: 'acceptance', // 'acceptance' | 'leftover'
    selectedDishId: null,
    currentWeight: 0,
    dishes: [],
    records: [],
    // 去皮设置
    tareCount: 1,     // 份数盆数量
    tareUnitWeight: 150, // 单盆重 (g)
};

// 预设菜品数据
const DISH_DATA = [
    { id: 1, name: '招牌红烧肉', category: '全荤' },
    { id: 7, name: '酸菜鱼', category: '全荤' },
    { id: 3, name: '宫保鸡丁', category: '主荤' },
    { id: 5, name: '黑椒牛柳', category: '主荤' },
    { id: 4, name: '番茄炒蛋', category: '副荤' },
    { id: 6, name: '麻婆豆腐', category: '副荤' },
    { id: 8, name: '玉米排骨汤', category: '副荤' },
    { id: 2, name: '清炒时蔬', category: '全素' }
];

// 初始化
function init() {
    loadData(); // 加载本地数据

    // 如果没有数据，初始化默认菜品
    if (state.dishes.length === 0) {
        state.dishes = DISH_DATA.map(d => ({
            ...d,
            acceptanceRecordId: null,
            leftoverRecordId: null
        }));
    } else {
        // 兼容旧数据，补充 category 字段
        state.dishes.forEach(d => {
            if (!d.category) {
                const def = DISH_DATA.find(x => x.id === d.id);
                if (def) d.category = def.category;
            }
        });
    }

    startCamera();
    renderGrid();
    renderLog();
    updateActionPanel();
    updateTareInfo(); // 更新去皮信息显示

    // 更新时间
    setInterval(() => {
        const now = new Date();
        document.getElementById('current-time').innerText =
            now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }, 1000);
}

// 切换模式
window.switchMode = function (mode) {
    state.currentMode = mode;
    state.selectedDishId = null;

    document.getElementById('btn-mode-acceptance').classList.toggle('active', mode === 'acceptance');
    document.getElementById('btn-mode-leftover').classList.toggle('active', mode === 'leftover');
    document.getElementById('log-title').innerText = mode === 'acceptance' ? '验收记录' : '剩餐记录';

    renderGrid();
    renderLog();
    updateActionPanel();
};

// 选择菜品
window.selectDish = function (id) {
    const dish = getDish(id);
    const hasRecord = hasRecordForCurrentMode(dish);

    // 如果已完成，禁止选择并给予提示
    if (hasRecord) {
        showToast(`⚠️ 该菜品已${state.currentMode === 'acceptance' ? '验收' : '记录'}，请在右侧先删除记录再操作`);
        return;
    }

    state.selectedDishId = id;
    renderGrid();
    updateActionPanel();

    // 自动模拟称重
    simulateNewWeight();
};

// 模拟称重
// 模拟称重
window.simulateNewWeight = function () {
    // 模拟毛重 (500g - 5000g)
    const rawWeight = Math.random() * 4500 + 500;
    const tareWeight = state.tareCount * state.tareUnitWeight;

    // 计算净重，最少为0
    let netWeight = rawWeight - tareWeight;
    if (netWeight < 0) netWeight = 0;

    const el = document.getElementById('weight-value');

    // 动画
    el.style.transform = 'scale(1.1)';
    el.style.transition = 'transform 0.1s';
    setTimeout(() => el.style.transform = 'scale(1)', 100);

    state.currentWeight = netWeight.toFixed(0);
    el.innerText = state.currentWeight;
};

// 截图功能
function captureImage() {
    const video = document.getElementById('camera-feed');

    // 检查视频源是否存在且已加载
    if (!video || !video.srcObject || video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn('摄像头未就绪，生成占位图片');
        // 创建占位图片
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(0, 0, 300, 300);

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📷', 150, 130);
        ctx.font = '14px Arial';
        ctx.fillText('无摄像头', 150, 160);

        return canvas.toDataURL('image/jpeg', 0.8);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 300; // 降低分辨率以节省存储
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    // 绘制视频帧 (假设视频是正方形或已裁剪，这里简单绘制)
    // 保持比例居中裁剪
    const vRatio = video.videoWidth / video.videoHeight;
    let sx, sy, sWidth, sHeight;
    if (vRatio > 1) {
        sHeight = video.videoHeight;
        sWidth = sHeight;
        sx = (video.videoWidth - sHeight) / 2;
        sy = 0;
    } else {
        sWidth = video.videoWidth;
        sHeight = sWidth;
        sx = 0;
        sy = (video.videoHeight - sWidth) / 2;
    }


    try {
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, 300, 300);
        console.log('✓ 成功捕获图片');
        return canvas.toDataURL('image/jpeg', 0.8);
    } catch (e) {
        console.error('截图失败:', e);
        return null;
    }
}

// 确认记录 (验收/剩餐)
window.handlePrimaryAction = function () {
    if (!state.selectedDishId) return;
    const dish = getDish(state.selectedDishId);

    // 捕获图片
    const imgData = captureImage();

    if (state.currentMode === 'acceptance') {
        const recordId = createRecord('acceptance', dish.name, `${state.currentWeight} g`, imgData);
        dish.acceptanceRecordId = recordId;
        showToast(`✅ ${dish.name} 验收成功`);
    } else {
        const recordId = createRecord('leftover', dish.name, `${state.currentWeight} g`, imgData);
        dish.leftoverRecordId = recordId;
        showToast(`✅ ${dish.name} 剩餐已记录`);
    }

    // 操作完成后，重置选择状态
    state.selectedDishId = null;

    triggerFlash();
    renderGrid();
    renderLog();
    updateActionPanel();
};

// 标记售罄
window.handleSoldOut = function () {
    if (!state.selectedDishId) return;
    const dish = getDish(state.selectedDishId);

    // 售罄不需要拍照，因为没有实物
    const recordId = createRecord('leftover', dish.name, '已售罄', null);
    dish.leftoverRecordId = recordId;

    state.selectedDishId = null;

    showToast(`🚫 ${dish.name} 标记售罄`);
    renderGrid();
    renderLog();
    updateActionPanel();
};

// ================= 去皮逻辑 =================

window.showTareModal = function () {
    document.getElementById('tare-modal').classList.remove('hidden');
    // 回显当前值
    document.getElementById('tare-unit-weight').value = state.tareUnitWeight;
    // 自动聚焦
    setTimeout(() => document.getElementById('tare-unit-weight').focus(), 100);
};

window.closeTareModal = function () {
    document.getElementById('tare-modal').classList.add('hidden');
};

window.confirmTare = function () {
    const unit = parseFloat(document.getElementById('tare-unit-weight').value);

    if (isNaN(unit) || unit < 0) {
        alert('请输入有效的数值');
        return;
    }

    state.tareCount = 1;
    state.tareUnitWeight = unit;

    updateTareInfo();
    closeTareModal();

    // 如果当前正选中菜品，重新计算重量
    if (state.selectedDishId) {
        simulateNewWeight();
    }

    showToast('去皮设置已更新');
};

function updateTareInfo() {
    const infoEl = document.getElementById('tare-info');

    if (state.tareCount > 0 && state.tareUnitWeight > 0) {
        infoEl.style.display = 'inline';
        infoEl.innerText = `(已去皮 ${state.tareUnitWeight}g)`;
    } else {
        infoEl.style.display = 'none';
    }
}


// 删除记录
window.handleDeleteRecord = function (recordId) {
    // 找到对应菜品重置状态
    const dish = state.dishes.find(d => d.acceptanceRecordId === recordId || d.leftoverRecordId === recordId);
    if (dish) {
        if (dish.acceptanceRecordId === recordId) dish.acceptanceRecordId = null;
        if (dish.leftoverRecordId === recordId) dish.leftoverRecordId = null;
    }

    deleteRecord(recordId);
    showToast('🗑️ 记录已删除，现在可重新操作该菜品');

    renderGrid();
    renderLog();
};

// 数据持久化
function saveData() {
    localStorage.setItem('food_truck_dishes', JSON.stringify(state.dishes));
    localStorage.setItem('food_truck_records', JSON.stringify(state.records));
}

function loadData() {
    const dishes = localStorage.getItem('food_truck_dishes');
    const records = localStorage.getItem('food_truck_records');
    if (dishes) state.dishes = JSON.parse(dishes);
    if (records) state.records = JSON.parse(records);
}

// 数据处理
function getDish(id) {
    return state.dishes.find(d => d.id === id);
}

function hasRecordForCurrentMode(dish) {
    if (state.currentMode === 'acceptance') return !!dish.acceptanceRecordId;
    return !!dish.leftoverRecordId;
}

function createRecord(type, name, detail, image = null) {
    const id = Date.now().toString();
    state.records.unshift({
        id,
        type,
        time: new Date().toLocaleTimeString(),
        name,
        detail,
        image  // 存储图片数据 (base64)
    });
    saveData(); // 保存
    return id;
}

function deleteRecord(id) {
    state.records = state.records.filter(r => r.id !== id);
    saveData(); // 保存
}

// 渲染网格
function renderGrid() {
    const grid = document.getElementById('dish-grid');
    grid.innerHTML = '';

    // 按分类分组
    const categories = ['全荤', '主荤', '副荤', '全素'];
    const grouped = {};

    categories.forEach(cat => {
        grouped[cat] = state.dishes.filter(d => d.category === cat);
    });

    // 渲染每个分类
    categories.forEach(category => {
        const dishes = grouped[category];
        if (dishes.length === 0) return;

        // 创建分类标题
        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `<span>${category}</span>`;
        grid.appendChild(header);

        // 渲染该分类下的菜品
        dishes.forEach(dish => {
            const el = document.createElement('div');
            const isDone = hasRecordForCurrentMode(dish);
            const isSelected = state.selectedDishId === dish.id;

            el.className = `dish-card ${isSelected ? 'selected' : ''} ${isDone ? 'disabled' : ''}`;
            el.onclick = () => selectDish(dish.id);
            el.innerHTML = `<span>${dish.name}</span>`;

            grid.appendChild(el);
        });
    });
}

// 渲染操作面板
function updateActionPanel() {
    const dish = getDish(state.selectedDishId);

    const nameEl = document.getElementById('selected-dish-name');
    const statusEl = document.getElementById('selected-dish-status');
    const btnPrimary = document.getElementById('btn-primary-action');
    const btnSecondary = document.getElementById('btn-secondary-action');

    // 摄像头相关元素
    const videoEl = document.getElementById('camera-feed');
    const placeholderEl = document.getElementById('camera-placeholder');
    const msgEl = document.getElementById('camera-msg');

    // 模式特定按钮文案
    if (state.currentMode === 'acceptance') {
        btnPrimary.innerHTML = '<i class="fa-solid fa-check"></i> 确认验收';
        btnSecondary.classList.add('hidden');
    } else {
        btnPrimary.innerHTML = '<i class="fa-solid fa-scale-balanced"></i> 记录剩餐';
        btnSecondary.classList.remove('hidden');
    }

    if (!dish) {
        nameEl.innerText = '请从左侧选择菜品';
        statusEl.innerText = '等待操作';
        statusEl.className = 'status-tag'; // default
        btnPrimary.disabled = true;
        btnSecondary.disabled = true;

        // 未选择菜品：隐藏视频，显示占位符
        videoEl.classList.add('hidden');
        placeholderEl.classList.remove('hidden');
        if (msgEl) msgEl.innerText = '请先选择左侧菜品';

        return;
    }

    nameEl.innerText = dish.name;
    statusEl.innerText = '准备录入...';
    statusEl.className = 'status-tag active';

    btnPrimary.disabled = false;
    btnSecondary.disabled = false;

    // 已选择菜品：显示视频，隐藏占位符 (如果摄像头已就绪)
    // 简单处理：只要选择了就尝试显示视频
    videoEl.classList.remove('hidden');
    placeholderEl.classList.add('hidden');
}

// 渲染日志
function renderLog() {
    const list = document.getElementById('log-list');
    const filtered = state.records.filter(r => r.type === state.currentMode);

    if (filtered.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:2rem;">暂无记录</div>';
        return;
    }

    list.innerHTML = filtered.map(rec => {
        // 如果有图片，显示缩略图（使用 data-image 属性存储，避免引号问题）
        const imageHtml = rec.image
            ? `<img src="${rec.image}" class="log-thumbnail" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-top: 0.5rem; cursor: pointer; border: 1px solid #e2e8f0;">`
            : '';

        return `
            <div class="log-item" data-record-id="${rec.id}">
                <div class="log-item-header">
                    <span>${rec.time}</span>
                    <button class="btn-delete-sm" onclick="handleDeleteRecord('${rec.id}')">删除</button>
                </div>
                <div class="log-item-body">
                    <span class="log-name">${rec.name}</span>
                    <span class="log-value">${rec.detail}</span>
                </div>
                ${imageHtml}
            </div>
        `;
    }).join('');

    // 使用事件委托为缩略图添加点击事件
    list.querySelectorAll('.log-thumbnail').forEach((img, index) => {
        const rec = filtered[index];
        if (rec && rec.image) {
            img.onclick = () => viewImageModal(rec.image);
        }
    });
}

// 查看大图模态框
window.viewImageModal = function (imgSrc) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; justify-content: center; align-items: center; cursor: pointer;';
    modal.onclick = () => modal.remove();

    const img = document.createElement('img');
    img.src = imgSrc;
    img.style.cssText = 'max-width: 90%; max-height: 90%; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);';

    modal.appendChild(img);
    document.body.appendChild(modal);
};

// 硬件模拟
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        document.getElementById('camera-feed').srcObject = stream;
        // 不再自动显示，由 updateActionPanel 控制
    } catch (e) {
        console.warn('Camera access denied or n/a', e);
        const msg = document.getElementById('camera-msg');
        if (msg) msg.innerText = '无法访问摄像头 (模拟模式)';
    }
}

function triggerFlash() {
    const overlay = document.getElementById('flash-overlay');
    overlay.style.opacity = '1';
    setTimeout(() => overlay.style.opacity = '0', 200);
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.classList.remove('hidden');
    // 自动隐藏逻辑：防止多次点击重叠，这里简单处理
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
}

document.addEventListener('DOMContentLoaded', init);
