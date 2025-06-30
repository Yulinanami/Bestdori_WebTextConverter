// --- START OF FILE static/js/main.js ---

let currentResult = '';
let currentConfig = {};
let quotesConfig = {};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // 绑定事件监听器
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('convertBtn').addEventListener('click', convertText);
    document.getElementById('previewBtn').addEventListener('click', previewResult);
    document.getElementById('configBtn').addEventListener('click', openConfigModal);
    document.getElementById('downloadBtn').addEventListener('click', downloadResult);
    document.getElementById('addConfigBtn').addEventListener('click', addConfigItem);
    document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
    document.getElementById('addCustomQuoteBtn').addEventListener('click', addCustomQuoteOption);

    // 文件拖拽功能
    setupFileDragDrop();
    
    // 加载配置
    loadConfig();
}

function addCustomQuoteOption() {
    const openChar = document.getElementById('customQuoteOpen').value;
    const closeChar = document.getElementById('customQuoteClose').value;

    if (!openChar || !closeChar) {
        showStatus('起始和结束符号都不能为空！', 'error');
        return;
    }
    
    // 创建一个新的复选框和标签
    const categoryName = `${openChar}...${closeChar}`;
    const checkboxId = `quote-check-custom-${Date.now()}`; // 用时间戳确保ID唯一
    const container = document.getElementById('quoteOptionsContainer');

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = checkboxId;
    // 使用 dataset 来存储实际的引号字符，这非常重要！
    checkbox.dataset.open = openChar;
    checkbox.dataset.close = closeChar;
    checkbox.className = 'quote-option-checkbox'; // 保持统一的类名
    checkbox.checked = true; // 新添加的默认选中
    
    const label = document.createElement('label');
    label.htmlFor = checkboxId;
    label.textContent = categoryName;
    label.style.marginLeft = '8px';
    label.style.cursor = 'pointer';

    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    container.appendChild(wrapper);

    // 清空输入框以便下次输入
    document.getElementById('customQuoteOpen').value = '';
    document.getElementById('customQuoteClose').value = '';
}

function setupFileDragDrop() {
    const fileUpload = document.getElementById('fileUpload');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileUpload.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        fileUpload.addEventListener(eventName, () => fileUpload.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        fileUpload.addEventListener(eventName, () => fileUpload.classList.remove('dragover'), false);
    });

    fileUpload.addEventListener('drop', handleDrop, false);
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        document.getElementById('fileInput').files = files;
        handleFileUpload({ target: { files: files } });
    }
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.txt')) {
        showStatus('只支持.txt文件！', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        showProgress(20);
        showStatus('正在上传文件...', 'info');

        const response = await axios.post('/api/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        showProgress(100);
        document.getElementById('inputText').value = response.data.content;
        showStatus('文件上传成功！', 'success');
        
        setTimeout(() => hideProgress(), 1000);
    } catch (error) {
        showStatus(`文件上传失败: ${error.response?.data?.error || error.message}`, 'error');
        hideProgress();
    }
}

async function convertText() {
    const inputText = document.getElementById('inputText').value.trim();
    const narratorName = document.getElementById('narratorName').value || ' ';

    if (!inputText) {
        showStatus('请输入要转换的文本！', 'error');
        return;
    }

    // 获取用户选择的引号对数组
    const selectedQuotePairs = getSelectedQuotes();

    const convertBtn = document.getElementById('convertBtn');
    const convertIcon = document.getElementById('convertIcon');
    const convertTextEl = document.getElementById('convertText');

    try {
        // 更新按钮状态
        convertBtn.disabled = true;
        convertIcon.innerHTML = '<div class="loading"></div>';
        convertTextEl.textContent = '转换中...';

        showProgress(10);
        showStatus('正在处理文本...', 'info');

        // 发起API请求，将新的数据结构发送给后端
        const response = await axios.post('/api/convert', {
            text: inputText,
            narrator_name: narratorName,
            selected_quote_pairs: selectedQuotePairs // 使用新的键和数据格式
        });

        // 处理成功响应
        showProgress(100);
        currentResult = response.data.result;
        
        document.getElementById('resultContent').textContent = currentResult;
        document.getElementById('resultSection').style.display = 'block';
        
        showStatus('转换完成！', 'success');
        
        // 滚动到结果区域
        document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });

        setTimeout(() => hideProgress(), 1000);

    } catch (error) {
        // 处理错误
        showStatus(`转换失败: ${error.response?.data?.error || error.message}`, 'error');
        hideProgress();
    } finally {
        // 恢复按钮状态
        convertBtn.disabled = false;
        convertIcon.textContent = '🔄';
        convertTextEl.textContent = '开始转换';
    }
}

function previewResult() {
    const inputText = document.getElementById('inputText').value.trim();
    
    if (!inputText) {
        showStatus('请先输入要转换的文本！', 'error');
        return;
    }

    // 截取预览文本
    const previewText = inputText.substring(0, 500) + (inputText.length > 500 ? '...' : '');
    const narratorName = document.getElementById('narratorName').value || ' ';
    
    // 同样获取用户选择的引号对数组
    const selectedQuotePairs = getSelectedQuotes(); 

    // 发起API请求，将新的数据结构发送给后端
    axios.post('/api/convert', {
        text: previewText,
        narrator_name: narratorName,
        selected_quote_pairs: selectedQuotePairs // 使用新的键和数据格式
    }).then(response => {
        // 处理成功响应
        document.getElementById('previewContent').textContent = response.data.result;
        openModal('previewModal'); // 使用 openModal 函数打开模态框
    }).catch(error => {
        // 处理错误
        showStatus(`预览失败: ${error.response?.data?.error || error.message}`, 'error');
    });
}

async function loadConfig() {
    try {
        const response = await axios.get('/api/config');
        currentConfig = response.data.character_mapping;
        quotesConfig = response.data.quotes_config; // 保存引号配置
        renderQuoteOptions(); // 动态渲染引号选项
    } catch (error) {
        console.error('加载配置失败:', error);
        showStatus('无法加载应用配置', 'error');
    }
}

function renderQuoteOptions() {
    const container = document.getElementById('quoteOptionsContainer');
    container.innerHTML = '';
    
    if (!quotesConfig || !quotesConfig.quote_categories) return;

    Object.entries(quotesConfig.quote_categories).forEach(([categoryName, chars]) => {
        const checkboxId = `quote-check-${categoryName.replace(/\s/g, '-')}`;
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.className = 'quote-option-checkbox';
        checkbox.value = categoryName;
        // 关键：将预设的引号也存入 dataset
        checkbox.dataset.open = chars[0];
        checkbox.dataset.close = chars[1];
        checkbox.checked = true;
        
        const label = document.createElement('label');
        label.htmlFor = checkboxId;
        label.textContent = categoryName;
        label.style.marginLeft = '8px';
        label.style.cursor = 'pointer';

        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        container.appendChild(wrapper);
    });
}

function getSelectedQuotes() {
    const selectedPairs = [];
    // 遍历所有选中的复选框，无论是预设的还是自定义的
    document.querySelectorAll('.quote-option-checkbox:checked').forEach(checkbox => {
        // 从 dataset 中读取起始和结束符号
        const openChar = checkbox.dataset.open;
        const closeChar = checkbox.dataset.close;
        if (openChar && closeChar) {
            selectedPairs.push([openChar, closeChar]);
        }
    });
    return selectedPairs;
}

function openConfigModal() {
    renderConfigList();
    document.getElementById('configModal').style.display = 'block';
}

function renderConfigList() {
    const configList = document.getElementById('configList');
    configList.innerHTML = '';

    Object.entries(currentConfig).forEach(([name, ids]) => {
        const configItem = document.createElement('div');
        configItem.className = 'config-item';
        configItem.innerHTML = `
            <input type="text" placeholder="角色名称" value="${name}" class="form-input config-name">
            <input type="text" placeholder="ID列表(逗号分隔)" value="${ids.join(',')}" class="form-input config-ids">
            <button class="remove-btn" onclick="removeConfigItem(this)">删除</button>
        `;
        configList.appendChild(configItem);
    });
}

function addConfigItem() {
    const configList = document.getElementById('configList');
    const configItem = document.createElement('div');
    configItem.className = 'config-item';
    configItem.innerHTML = `
        <input type="text" placeholder="角色名称" class="form-input config-name">
        <input type="text" placeholder="ID列表(逗号分隔)" class="form-input config-ids">
        <button class="remove-btn" onclick="removeConfigItem(this)">删除</button>
    `;
    configList.appendChild(configItem);
}

function removeConfigItem(button) {
    button.parentElement.remove();
}

async function saveConfig() {
    const configItems = document.querySelectorAll('.config-item');
    const newConfig = {};

    configItems.forEach(item => {
        const name = item.querySelector('.config-name').value.trim();
        const idsStr = item.querySelector('.config-ids').value.trim();
        
        if (name && idsStr) {
            const ids = idsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (ids.length > 0) {
                newConfig[name] = ids;
            }
        }
    });

    try {
        await axios.post('/api/config', {
            character_mapping: newConfig
        });
        
        currentConfig = newConfig;
        showStatus('配置保存成功！', 'success');
        closeModal('configModal');
    } catch (error) {
        showStatus(`配置保存失败: ${error.response?.data?.error || error.message}`, 'error');
    }
}

function downloadResult() {
    if (!currentResult) {
        showStatus('没有可下载的结果！', 'error');
        return;
    }

    const filename = `result_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.json`;
    
    axios.post('/api/download', {
        content: currentResult,
        filename: filename
    }, {
        responseType: 'blob'
    }).then(response => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        showStatus('文件下载成功！', 'success');
    }).catch(error => {
        showStatus(`下载失败: ${error.response?.data?.error || error.message}`, 'error');
    });
}

function showProgress(percent) {
    document.getElementById('progressContainer').style.display = 'block';
    document.getElementById('progressFill').style.width = percent + '%';
}

function hideProgress() {
    document.getElementById('progressContainer').style.display = 'none';
    document.getElementById('progressFill').style.width = '0%';
}

function showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    statusElement.style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// 点击模态框外部关闭
window.addEventListener('click', function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// ESC键关闭模态框
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
    }
});