// --- START OF FILE main.js (WITH NEW FEATURES) ---

let currentResult = '';
let currentConfig = {};
let quotesConfig = {};
let batchFiles = [];
let batchResults = [];
let autoPreviewEnabled = true;
let previewDebounceTimer = null;

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    // 原有按钮事件监听
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('convertBtn').addEventListener('click', convertText);
    document.getElementById('configBtn').addEventListener('click', openConfigModal);
    document.getElementById('downloadBtn').addEventListener('click', downloadResult);
    document.getElementById('addConfigBtn').addEventListener('click', addConfigItem);
    document.getElementById('saveConfigBtn').addEventListener('click', saveConfig);
    document.getElementById('addCustomQuoteBtn').addEventListener('click', addCustomQuoteOption);
    document.getElementById('formatTextBtn').addEventListener('click', formatText);
    document.getElementById('helpBtn').addEventListener('click', () => openModal('helpModal'));
    document.getElementById('batchProcessBtn').addEventListener('click', openBatchModal);
    document.getElementById('batchFileInput').addEventListener('change', updateBatchFileList);
    document.getElementById('startBatchBtn').addEventListener('click', startBatchConversion);
    document.getElementById('downloadBatchResultBtn').addEventListener('click', handleBatchDownload);

    // 新功能事件监听
    document.getElementById('previewModeBtn').addEventListener('click', showDialoguePreview);
    
    // 分屏视图相关
    document.getElementById('formatTextSplitBtn').addEventListener('click', formatTextSplit);
    document.getElementById('splitConvertBtn').addEventListener('click', updateSplitPreview);
    document.getElementById('splitDownloadBtn').addEventListener('click', downloadSplitResult);
    document.getElementById('autoPreviewCheckbox').addEventListener('change', (e) => {
        autoPreviewEnabled = e.target.checked;
        if (autoPreviewEnabled) {
            updateSplitPreview();
        }
    });
    
    // 分屏配置相关
    document.getElementById('splitQuoteConfigBtn').addEventListener('click', openSplitQuoteModal);
    document.getElementById('addSplitCustomQuoteBtn').addEventListener('click', addSplitCustomQuoteOption);
    document.getElementById('splitNarratorName').addEventListener('input', (e) => {
        document.getElementById('narratorName').value = e.target.value;
        if (autoPreviewEnabled) {
            debouncePreview();
        }
    });

    // 视图切换
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', switchView);
    });

    // 预览模式切换
    document.querySelectorAll('.preview-mode-btn').forEach(btn => {
        btn.addEventListener('click', switchPreviewMode);
    });

    // 文本输入监听（用于实时预览）
    document.getElementById('splitInputText').addEventListener('input', debouncePreview);

    // 同步两个文本框的内容
    document.getElementById('inputText').addEventListener('input', syncTextAreas);
    document.getElementById('splitInputText').addEventListener('input', syncTextAreas);
    
    // 同步旁白名称
    document.getElementById('narratorName').addEventListener('input', (e) => {
        document.getElementById('splitNarratorName').value = e.target.value;
    });

    // 初始化分隔条拖动功能
    initializeSplitResizer();

    setupFileDragDrop();
    loadConfig();
}

// 视图切换功能
function switchView(e) {
    const targetView = e.target.dataset.view;
    
    // 切换按钮状态
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    
    // 切换视图内容
    document.querySelectorAll('.view-content').forEach(view => view.classList.remove('active'));
    document.getElementById(targetView + 'View').classList.add('active');
    
    // 如果切换到分屏视图，同步内容并更新预览
    if (targetView === 'split') {
        syncTextAreas();
        syncConfigToSplit();
        if (autoPreviewEnabled) {
            updateSplitPreview();
        }
    }
}

// 预览模式切换
function switchPreviewMode(e) {
    const mode = e.target.dataset.mode;
    
    // 切换按钮状态
    document.querySelectorAll('.preview-mode-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    
    // 切换预览内容
    if (mode === 'json') {
        document.getElementById('splitPreviewJson').style.display = 'block';
        document.getElementById('splitPreviewDialogue').style.display = 'none';
    } else {
        document.getElementById('splitPreviewJson').style.display = 'none';
        document.getElementById('splitPreviewDialogue').style.display = 'block';
    }
}

// 同步两个文本框的内容
function syncTextAreas() {
    const classicText = document.getElementById('inputText').value;
    const splitText = document.getElementById('splitInputText').value;
    
    if (document.getElementById('classicView').classList.contains('active')) {
        document.getElementById('splitInputText').value = classicText;
    } else {
        document.getElementById('inputText').value = splitText;
    }
}

// 防抖预览更新
function debouncePreview() {
    if (!autoPreviewEnabled) return;
    
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = setTimeout(() => {
        updateSplitPreview();
    }, 500);
}

// 更新分屏预览
async function updateSplitPreview() {
    const inputText = document.getElementById('splitInputText').value.trim();
    if (!inputText) {
        document.querySelector('#splitPreviewJson code').textContent = '// 请输入文本以查看预览';
        document.getElementById('splitPreviewDialogue').innerHTML = '<p style="text-align: center; color: #718096;">请输入文本以查看预览</p>';
        return;
    }
    
    // 使用分屏视图中的旁白名称设置
    const narratorName = document.getElementById('splitNarratorName').value || ' ';
    const selectedQuotePairs = getSelectedQuotes();
    
    try {
        const response = await axios.post('/api/convert', {
            text: inputText,
            narrator_name: narratorName,
            selected_quote_pairs: selectedQuotePairs
        });
        
        const jsonResult = response.data.result;
        currentResult = jsonResult;
        
        // 更新JSON预览
        document.querySelector('#splitPreviewJson code').textContent = jsonResult;
        Prism.highlightElement(document.querySelector('#splitPreviewJson code'));
        
        // 更新对话预览
        updateDialoguePreview(jsonResult, 'splitPreviewDialogue');
        
    } catch (error) {
        const errorMsg = `转换失败: ${error.response?.data?.error || error.message}`;
        document.querySelector('#splitPreviewJson code').textContent = `// ${errorMsg}`;
        document.getElementById('splitPreviewDialogue').innerHTML = `<p style="text-align: center; color: #e53e3e;">${errorMsg}</p>`;
    }
}

// 更新对话预览
function updateDialoguePreview(jsonStr, containerId) {
    try {
        const data = JSON.parse(jsonStr);
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        if (!data.actions || data.actions.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #718096;">没有对话内容</p>';
            return;
        }
        
        data.actions.forEach((action, index) => {
            const isNarrator = !action.name || action.name.trim() === '' || action.name === ' ';
            
            const dialogueItem = document.createElement('div');
            dialogueItem.className = `dialogue-item ${isNarrator ? 'narrator' : ''}`;
            dialogueItem.style.animationDelay = `${index * 0.05}s`;
            
            if (!isNarrator) {
                // 创建头像
                const avatar = document.createElement('div');
                avatar.className = 'dialogue-avatar';
                avatar.textContent = action.name.charAt(0);
                // 根据角色ID设置不同的渐变色
                const characterId = action.characters && action.characters[0] ? action.characters[0] : 0;
                avatar.style.background = getAvatarGradient(characterId);
                dialogueItem.appendChild(avatar);
            }
            
            // 创建内容区域
            const content = document.createElement('div');
            content.className = 'dialogue-content';
            
            if (!isNarrator) {
                const name = document.createElement('div');
                name.className = 'dialogue-name';
                name.textContent = action.name;
                content.appendChild(name);
            }
            
            const text = document.createElement('div');
            text.className = 'dialogue-text';
            text.textContent = action.body;
            content.appendChild(text);
            
            dialogueItem.appendChild(content);
            container.appendChild(dialogueItem);
        });
    } catch (error) {
        container.innerHTML = `<p style="text-align: center; color: #e53e3e;">预览失败: ${error.message}</p>`;
    }
}

// 根据角色ID获取头像渐变色
function getAvatarGradient(id) {
    const gradients = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
        'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
    ];
    return gradients[id % gradients.length];
}

// 显示对话预览模态框
async function showDialoguePreview() {
    const inputText = document.getElementById('inputText').value.trim();
    if (!inputText) {
        showStatus('请先输入要转换的文本！', 'error');
        return;
    }
    
    const narratorName = document.getElementById('narratorName').value || ' ';
    const selectedQuotePairs = getSelectedQuotes();
    
    try {
        const response = await axios.post('/api/convert', {
            text: inputText,
            narrator_name: narratorName,
            selected_quote_pairs: selectedQuotePairs
        });
        
        updateDialoguePreview(response.data.result, 'dialogueContainer');
        openModal('dialoguePreviewModal');
        
    } catch (error) {
        showStatus(`预览失败: ${error.response?.data?.error || error.message}`, 'error');
    }
}

// 格式化分屏文本
function formatTextSplit() {
    const textarea = document.getElementById('splitInputText');
    const originalText = textarea.value;
    
    if (!originalText.trim()) {
        showStatus('文本内容为空，无需格式化。', 'info');
        return;
    }
    
    const lines = originalText.split(/\r?\n/);
    const contentLines = lines.map(line => line.trim()).filter(line => line.length > 0);
    const formattedText = contentLines.join('\n\n');
    
    textarea.value = formattedText;
    showStatus('文本已成功格式化！', 'success');
    
    if (autoPreviewEnabled) {
        updateSplitPreview();
    }
}

// 下载分屏结果
function downloadSplitResult() {
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

// 处理文件上传（支持新格式）
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const filename = file.name.toLowerCase();
    const validExtensions = ['.txt', '.docx', '.md'];
    const isValidFile = validExtensions.some(ext => filename.endsWith(ext));

    if (!isValidFile) {
        showStatus('只支持 .txt, .docx, .md 文件！', 'error');
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
        document.getElementById('splitInputText').value = response.data.content;
        showStatus('文件上传成功！', 'success');
        
        setTimeout(() => hideProgress(), 1000);
    } catch (error) {
        showStatus(`文件上传失败: ${error.response?.data?.error || error.message}`, 'error');
        hideProgress();
    }
}

// 批量文件列表更新（支持新格式）
function updateBatchFileList() {
    const fileInput = document.getElementById('batchFileInput');
    const fileList = document.getElementById('batchFileList');
    fileList.innerHTML = '';
    batchFiles = Array.from(fileInput.files);
    
    if (batchFiles.length > 0) {
        batchFiles.forEach(file => {
            const li = document.createElement('li');
            const icon = file.name.endsWith('.docx') ? '📄' : 
                        file.name.endsWith('.md') ? '📝' : '📃';
            li.textContent = `${icon} ${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
            fileList.appendChild(li);
        });
        document.getElementById('startBatchBtn').disabled = false;
    } else {
        document.getElementById('startBatchBtn').disabled = true;
    }
}

// ===== 以下是原有功能的保留部分 =====

function handleBatchDownload() {
    if (batchResults.length === 0) {
        showStatus('没有可下载的批量处理结果！', 'error');
        return;
    }

    const zip = new JSZip();
    
    batchResults.forEach(result => {
        zip.file(result.name, result.content);
    });

    zip.generateAsync({ type: "blob" })
        .then(function(content) {
            const filename = `batch_results_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.zip`;
            saveAs(content, filename);
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
                    const filename = file.name.toLowerCase();
                    
                    // 根据文件类型选择读取方式
                    if (filename.endsWith('.docx')) {
                        reader.onload = () => resolve({ 
                            name: file.name, 
                            content: reader.result, 
                            encoding: 'base64' 
                        });
                        reader.readAsDataURL(file);
                    } else {
                        reader.onload = () => resolve({ 
                            name: file.name, 
                            content: reader.result, 
                            encoding: 'text' 
                        });
                        reader.readAsText(file);
                    }
                    reader.onerror = reject;
                });
            })
        );

        startBtn.style.display = 'none';
        document.getElementById('batchProgressSection').style.display = 'block';
        document.getElementById('batchLogSection').style.display = 'block';
        document.getElementById('batchLogOutput').innerHTML = '';

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
    document.getElementById('batchFileInput').value = '';
    const fileList = document.getElementById('batchFileList');
    if(fileList) fileList.innerHTML = '';

    const progressSection = document.getElementById('batchProgressSection');
    const logSection = document.getElementById('batchLogSection');
    const progressBar = document.getElementById('batchProgressBar');
    const statusText = document.getElementById('batchStatusText');
    
    progressSection.style.display = 'none';
    logSection.style.display = 'none';
    progressBar.style.width = '0%';
    statusText.textContent = '正在处理...';

    document.getElementById('downloadBatchResultBtn').style.display = 'none';
    const startBtn = document.getElementById('startBatchBtn');
    startBtn.style.display = 'inline-flex';
    startBtn.disabled = true;
    startBtn.innerHTML = '开始批量转换';

    const cancelBtn = document.querySelector('#batchConvertModal .btn-secondary[onclick*="batchConvertModal"]');
    if(cancelBtn) cancelBtn.style.display = 'inline-flex';

    batchFiles = [];
    batchResults = [];
    
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
    
    // 添加到主界面
    addCustomQuoteOptionToContainer(document.getElementById('quoteOptionsContainer'), 
                                   checkboxId, categoryName, openChar, closeChar, true);
    
    // 如果分屏引号容器存在，也添加到那里
    const splitContainer = document.getElementById('splitQuoteOptionsContainer');
    if (splitContainer) {
        addCustomQuoteOptionToContainer(splitContainer, 
                                       checkboxId + '-split', categoryName, openChar, closeChar, true);
    }

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
        Prism.highlightElement(document.getElementById('resultContent'));
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

    const lines = originalText.split(/\r?\n/);
    const contentLines = lines.map(line => line.trim()).filter(line => line.length > 0);
    const formattedText = contentLines.join('\n\n');

    textarea.value = formattedText;
    showStatus('文本已成功格式化！', 'success');
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

function openConfigModal() {
    renderConfigList();
    openModal('configModal');
}

function renderConfigList() {
    const configList = document.getElementById('configList');
    configList.innerHTML = '';

    const sortedConfig = Object.entries(currentConfig).sort(([, idsA], [, idsB]) => {
        const idA = idsA && idsA.length > 0 ? idsA[0] : Infinity;
        const idB = idsB && idsB.length > 0 ? idsB[0] : Infinity;
        return idA - idB;
    });

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

// ===== 新增功能函数 =====

// 初始化分隔条拖动功能
function initializeSplitResizer() {
    const resizer = document.getElementById('splitResizer');
    const leftPanel = document.querySelector('.left-panel');
    const rightPanel = document.querySelector('.right-panel');
    const container = document.querySelector('.split-container');
    
    if (!resizer) return;
    
    let isResizing = false;
    let startX = 0;
    let startLeftWidth = 0;
    
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startLeftWidth = leftPanel.offsetWidth;
        
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const dx = e.clientX - startX;
        const containerWidth = container.offsetWidth;
        const newLeftWidth = startLeftWidth + dx;
        
        // 设置最小和最大宽度限制
        const minWidth = 300;
        const maxWidth = containerWidth - minWidth - resizer.offsetWidth;
        
        if (newLeftWidth >= minWidth && newLeftWidth <= maxWidth) {
            const leftPercent = (newLeftWidth / containerWidth) * 100;
            const rightPercent = 100 - leftPercent - (resizer.offsetWidth / containerWidth * 100);
            
            leftPanel.style.flex = `0 0 ${leftPercent}%`;
            rightPanel.style.flex = `0 0 ${rightPercent}%`;
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// 打开分屏引号设置模态框
function openSplitQuoteModal() {
    // 同步引号选项到分屏模态框
    const mainContainer = document.getElementById('quoteOptionsContainer');
    const splitContainer = document.getElementById('splitQuoteOptionsContainer');
    
    // 克隆主要的引号选项
    splitContainer.innerHTML = mainContainer.innerHTML;
    
    // 重新绑定事件
    splitContainer.querySelectorAll('.quote-option-checkbox').forEach((checkbox, index) => {
        const mainCheckbox = mainContainer.querySelectorAll('.quote-option-checkbox')[index];
        checkbox.checked = mainCheckbox.checked;
        
        checkbox.addEventListener('change', () => {
            mainCheckbox.checked = checkbox.checked;
            if (autoPreviewEnabled) {
                updateSplitPreview();
            }
        });
    });
    
    openModal('splitQuoteModal');
}

// 添加分屏自定义引号选项
function addSplitCustomQuoteOption() {
    const openChar = document.getElementById('splitCustomQuoteOpen').value;
    const closeChar = document.getElementById('splitCustomQuoteClose').value;

    if (!openChar || !closeChar) {
        showStatus('起始和结束符号都不能为空！', 'error');
        return;
    }
    
    // 同时添加到主界面和分屏界面
    const categoryName = `${openChar}...${closeChar}`;
    const checkboxId = `quote-check-custom-${Date.now()}`;
    
    // 添加到主界面
    addCustomQuoteOptionToContainer(document.getElementById('quoteOptionsContainer'), 
                                   checkboxId, categoryName, openChar, closeChar, true);
    
    // 添加到分屏界面
    addCustomQuoteOptionToContainer(document.getElementById('splitQuoteOptionsContainer'), 
                                   checkboxId + '-split', categoryName, openChar, closeChar, true);
    
    document.getElementById('splitCustomQuoteOpen').value = '';
    document.getElementById('splitCustomQuoteClose').value = '';
    
    if (autoPreviewEnabled) {
        updateSplitPreview();
    }
}

// 辅助函数：添加自定义引号选项到指定容器
function addCustomQuoteOptionToContainer(container, checkboxId, categoryName, openChar, closeChar, checked) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = checkboxId;
    checkbox.dataset.open = openChar;
    checkbox.dataset.close = closeChar;
    checkbox.className = 'quote-option-checkbox';
    checkbox.checked = checked;
    
    const label = document.createElement('label');
    label.htmlFor = checkboxId;
    label.textContent = categoryName;
    label.style.marginLeft = '8px';
    label.style.cursor = 'pointer';

    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    container.appendChild(wrapper);
}

// 同步配置到分屏视图
function syncConfigToSplit() {
    const narratorName = document.getElementById('narratorName').value;
    document.getElementById('splitNarratorName').value = narratorName;
}