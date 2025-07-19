// --- START OF FILE main.js (FINAL CORRECTED VERSION) ---

let currentResult = '';
let currentConfig = {};
let quotesConfig = {};
let batchFiles = []; // 存储用户选择的批量文件
let batchResults = []; // 存储批量处理的结果

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    // 为所有按钮绑定事件监听
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('convertBtn').addEventListener('click', convertText);
    document.getElementById('previewBtn').addEventListener('click', previewResult);
    document.getElementById('configBtn').addEventListener('click', openConfigModal);
    document.getElementById('downloadBtn').addEventListener('click', downloadResult);
    document.getElementById('addConfigBtn').addEventListener('click', addConfigItem);
    document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
    document.getElementById('addCustomQuoteBtn').addEventListener('click', addCustomQuoteOption);
    document.getElementById('formatTextBtn').addEventListener('click', formatText);
    document.getElementById('helpBtn').addEventListener('click', () => openModal('helpModal'));

    const batchProcessBtn = document.getElementById('batchProcessBtn');
    if (batchProcessBtn) {
        batchProcessBtn.addEventListener('click', openBatchModal);
    }
    document.getElementById('batchFileInput').addEventListener('change', updateBatchFileList);
    document.getElementById('startBatchBtn').addEventListener('click', startBatchConversion);
    document.getElementById('downloadBatchResultBtn').addEventListener('click', handleBatchDownload);

    setupFileDragDrop();
    loadConfig();
}

function updateBatchFileList() {
    const fileInput = document.getElementById('batchFileInput');
    const fileList = document.getElementById('batchFileList');
    fileList.innerHTML = '';
    batchFiles = Array.from(fileInput.files);
    
    if (batchFiles.length > 0) {
        batchFiles.forEach(file => {
            const li = document.createElement('li');
            li.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
            fileList.appendChild(li);
        });
        document.getElementById('startBatchBtn').disabled = false;
    } else {
        document.getElementById('startBatchBtn').disabled = true;
    }
}

// --- 新增：批量下载处理函数 ---
function handleBatchDownload() {
    if (batchResults.length === 0) {
        showStatus('没有可下载的批量处理结果！', 'error');
        return;
    }

    const zip = new JSZip();
    
    // 将每个JSON结果添加到zip文件中
    batchResults.forEach(result => {
        zip.file(result.name, result.content);
    });

    // 生成zip文件并触发下载
    zip.generateAsync({ type: "blob" })
        .then(function(content) {
            const filename = `batch_results_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.zip`;
            saveAs(content, filename); // 使用 FileSaver.js 保存文件
            showStatus('结果已打包下载！', 'success');
        })
        .catch(err => {
            showStatus(`打包下载失败: ${err.message}`, 'error');
        });
}

async function startBatchConversion() {
    if (batchFiles.length === 0) {
        showStatus('请先选择文件！', 'error');
        return;
    }

    const startBtn = document.getElementById('startBatchBtn');
    startBtn.disabled = true;
    startBtn.innerHTML = '<div class="loading"></div> 上传并准备中...';

    try {
        const filesData = await Promise.all(
            batchFiles.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve({ name: file.name, content: reader.result });
                    reader.onerror = reject;
                    reader.readAsText(file);
                });
            })
        );

        startBtn.style.display = 'none';
        document.getElementById('batchProgressSection').style.display = 'block';
        document.getElementById('batchLogSection').style.display = 'block';
        document.getElementById('batchLogOutput').innerHTML = ''; // 清空旧日志

        const narratorName = document.getElementById('narratorName').value || ' ';
        const selectedQuotePairs = getSelectedQuotes();

        const response = await axios.post('/api/batch_convert/start', {
            files: filesData,
            narrator_name: narratorName,
            selected_quote_pairs: selectedQuotePairs
        });

        const { task_id } = response.data;
        if (task_id) {
            pollBatchStatus(task_id);
        } else {
            throw new Error("未能从服务器获取任务ID。");
        }
    } catch (error) {
        showStatus(`启动批量处理失败: ${error.response?.data?.error || error.message}`, 'error');
        // 发生错误时重置UI
        startBtn.disabled = false;
        startBtn.innerHTML = '开始批量转换';
        startBtn.style.display = 'inline-flex';
        document.getElementById('batchProgressSection').style.display = 'none';
        document.getElementById('batchLogSection').style.display = 'none';
    }
}

function pollBatchStatus(taskId) {
    const intervalId = setInterval(async () => {
        try {
            const response = await axios.get(`/api/batch_convert/status/${taskId}`);
            const data = response.data;

            // 更新UI
            document.getElementById('batchProgressBar').style.width = `${data.progress}%`;
            document.getElementById('batchStatusText').textContent = data.status_text;
            const logOutput = document.getElementById('batchLogOutput');
            logOutput.innerHTML = data.logs.join('<br>');
            logOutput.scrollTop = logOutput.scrollHeight;

            if (data.status === 'completed') {
                clearInterval(intervalId);
                
                batchResults = data.results || [];
                
                if (batchResults.length > 0) {
                    document.getElementById('downloadBatchResultBtn').style.display = 'inline-flex';
                }
                
                // --- 新增：任务完成后，隐藏“取消”按钮，让界面更干净 ---
                const cancelBtn = document.querySelector('#batchConvertModal .btn-secondary');
                if(cancelBtn) cancelBtn.style.display = 'none';
                
                showStatus('批量处理完成！', 'success');
            }
        } catch (error) {
            clearInterval(intervalId);
            document.getElementById('batchStatusText').textContent = '轮询状态失败，任务可能已在后台完成或中断。';
            showStatus(`获取处理状态失败: ${error.message}`, 'error');
        }
    }, 1500);
}

function openBatchModal() {
    // 重置文件选择UI
    document.getElementById('batchFileInput').value = '';
    const fileList = document.getElementById('batchFileList');
    if(fileList) fileList.innerHTML = '';

    // --- 解决方案：重置进度条和状态文本 ---
    const progressSection = document.getElementById('batchProgressSection');
    const logSection = document.getElementById('batchLogSection');
    const progressBar = document.getElementById('batchProgressBar');
    const statusText = document.getElementById('batchStatusText');
    
    progressSection.style.display = 'none'; // 隐藏整个进度区域
    logSection.style.display = 'none';       // 隐藏日志区域
    progressBar.style.width = '0%';          // 进度条归零
    statusText.textContent = '正在处理...';   // 恢复默认状态文本

    // 重置按钮状态
    document.getElementById('downloadBatchResultBtn').style.display = 'none';
    const startBtn = document.getElementById('startBatchBtn');
    startBtn.style.display = 'inline-flex';
    startBtn.disabled = true;
    startBtn.innerHTML = '开始批量转换';

    const cancelBtn = document.querySelector('#batchConvertModal .btn-secondary[onclick*="batchConvertModal"]');
    if(cancelBtn) cancelBtn.style.display = 'inline-flex';

    // 重置数据
    batchFiles = [];
    batchResults = [];
    
    // 打开模态框
    openModal('batchConvertModal');
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}


function addCustomQuoteOption() {
    const openChar = document.getElementById('customQuoteOpen').value;
    const closeChar = document.getElementById('customQuoteClose').value;

    if (!openChar || !closeChar) {
        showStatus('起始和结束符号都不能为空！', 'error');
        return;
    }
    
    const categoryName = `${openChar}...${closeChar}`;
    const checkboxId = `quote-check-custom-${Date.now()}`;
    const container = document.getElementById('quoteOptionsContainer');

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = checkboxId;
    checkbox.dataset.open = openChar;
    checkbox.dataset.close = closeChar;
    checkbox.className = 'quote-option-checkbox';
    checkbox.checked = true;
    
    const label = document.createElement('label');
    label.htmlFor = checkboxId;
    label.textContent = categoryName;
    label.style.marginLeft = '8px';
    label.style.cursor = 'pointer';

    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    container.appendChild(wrapper);

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
    e.preventDefault();
    e.stopPropagation();
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

    const selectedQuotePairs = getSelectedQuotes();
    const convertBtn = document.getElementById('convertBtn');
    const convertIcon = document.getElementById('convertIcon');
    const convertTextEl = document.getElementById('convertText');

    try {
        convertBtn.disabled = true;
        convertIcon.innerHTML = '<div class="loading"></div>';
        convertTextEl.textContent = '转换中...';

        showProgress(10);
        showStatus('正在处理文本...', 'info');

        const response = await axios.post('/api/convert', {
            text: inputText,
            narrator_name: narratorName,
            selected_quote_pairs: selectedQuotePairs
        });

        showProgress(100);
        currentResult = response.data.result;
        
        document.getElementById('resultContent').textContent = currentResult;
        document.getElementById('resultSection').style.display = 'block';
        
        showStatus('转换完成！', 'success');
        document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });

        setTimeout(() => hideProgress(), 1000);
    } catch (error) {
        showStatus(`转换失败: ${error.response?.data?.error || error.message}`, 'error');
        hideProgress();
    } finally {
        convertBtn.disabled = false;
        convertIcon.textContent = '🔄';
        convertTextEl.textContent = '开始转换';
    }
}

function formatText() {
    const textarea = document.getElementById('inputText');
    const originalText = textarea.value;

    if (!originalText.trim()) {
        showStatus('文本内容为空，无需格式化。', 'info');
        return;
    }

    // 1. 将文本按行分割，兼容Windows(\r\n)和Unix(\n)的换行符
    const lines = originalText.split(/\r?\n/);

    // 2. 移除所有空行和仅包含空白字符的行。
    //    首先 trim() 每行来去掉首尾空格，然后 filter() 掉空字符串。
    const contentLines = lines.map(line => line.trim()).filter(line => line.length > 0);

    // 3. 使用两个换行符（即一个空行）将所有有效内容行重新连接起来。
    //    这样可以确保每两段话之间都存在一个空行。
    const formattedText = contentLines.join('\n\n');

    // 4. 更新文本框并显示成功信息
    textarea.value = formattedText;
    showStatus('文本已成功格式化！', 'success');
}

// --- 修正后的 previewResult 函数 ---
function previewResult() {
    const inputText = document.getElementById('inputText').value.trim();
    
    if (!inputText) {
        showStatus('请先输入要转换的文本！', 'error');
        return;
    }

    const previewText = inputText.substring(0, 500) + (inputText.length > 500 ? '...' : '');
    const narratorName = document.getElementById('narratorName').value || ' ';
    const selectedQuotePairs = getSelectedQuotes(); 

    axios.post('/api/convert', {
        text: previewText,
        narrator_name: narratorName,
        selected_quote_pairs: selectedQuotePairs
    }).then(response => {
        document.getElementById('previewContent').textContent = response.data.result;
        openModal('previewModal'); // 使用新定义的 openModal 函数
    }).catch(error => {
        showStatus(`预览失败: ${error.response?.data?.error || error.message}`, 'error');
    });
}

async function loadConfig() {
    try {
        const response = await axios.get('/api/config');
        currentConfig = response.data.character_mapping;
        quotesConfig = response.data.quotes_config;
        renderQuoteOptions();
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
    document.querySelectorAll('.quote-option-checkbox:checked').forEach(checkbox => {
        const openChar = checkbox.dataset.open;
        const closeChar = checkbox.dataset.close;
        if (openChar && closeChar) {
            selectedPairs.push([openChar, closeChar]);
        }
    });
    return selectedPairs;
}

// --- 修正后的 openConfigModal 函数 ---
function openConfigModal() {
    renderConfigList();
    openModal('configModal'); // 统一使用 openModal
}

function renderConfigList() {
    const configList = document.getElementById('configList');
    configList.innerHTML = '';

    // 将配置对象转换为 [key, value] 数组，并根据 ID (value[0])进行升序排序
    const sortedConfig = Object.entries(currentConfig).sort(([, idsA], [, idsB]) => {
        const idA = idsA && idsA.length > 0 ? idsA[0] : Infinity;
        const idB = idsB && idsB.length > 0 ? idsB[0] : Infinity;
        return idA - idB;
    });

    // 遍历排序后的数组来渲染列表
    sortedConfig.forEach(([name, ids]) => {
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
    configList.prepend(configItem);
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
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    statusElement.style.display = 'block';
}

// 全局事件监听器
window.addEventListener('click', function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            closeModal(modal.id);
        }
    });
});

window.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            closeModal(modal.id);
        });
    }
});