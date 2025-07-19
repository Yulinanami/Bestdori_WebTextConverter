// app.js - 主应用入口文件

import { state } from './constants.js';
import { ui, initGlobalModalListeners } from './uiUtils.js';
import { viewManager } from './viewManager.js';
import { fileHandler } from './fileHandler.js';
import { converter } from './converter.js';
import { configManager } from './configManager.js';
import { quoteManager } from './quoteManager.js';
import { dialoguePreview } from './dialoguePreview.js';
import { batchProcessor } from './batchProcessor.js';

// 初始化应用
function initializeApp() {
    // 绑定经典视图事件
    bindClassicViewEvents();
    
    // 绑定分屏视图事件
    bindSplitViewEvents();
    
    // 绑定视图切换事件
    bindViewSwitchEvents();
    
    // 绑定模态框事件
    bindModalEvents();
    
    // 初始化文件拖拽
    fileHandler.setupFileDragDrop();
    
    // 加载配置
    configManager.loadConfig();
    
    // 初始化全局模态框监听器
    initGlobalModalListeners();
    
    // 初始化分隔条拖动功能
    viewManager.initializeSplitResizer();
}

// 绑定经典视图事件
function bindClassicViewEvents() {
    // 文件相关
    document.getElementById('fileInput').addEventListener('change', fileHandler.handleFileUpload.bind(fileHandler));
    document.getElementById('downloadBtn').addEventListener('click', fileHandler.downloadResult.bind(fileHandler));
    
    // 转换相关
    document.getElementById('convertBtn').addEventListener('click', converter.convertText.bind(converter));
    document.getElementById('formatTextBtn').addEventListener('click', viewManager.formatText.bind(viewManager));
    
    // 预览相关
    document.getElementById('previewModeBtn').addEventListener('click', dialoguePreview.showDialoguePreview.bind(dialoguePreview));
    
    // 配置相关
    document.getElementById('configBtn').addEventListener('click', configManager.openConfigModal.bind(configManager));
    document.getElementById('addConfigBtn').addEventListener('click', configManager.addConfigItem.bind(configManager));
    document.getElementById('saveConfigBtn').addEventListener('click', configManager.saveConfig.bind(configManager));
    
    // 引号相关
    document.getElementById('addCustomQuoteBtn').addEventListener('click', quoteManager.addCustomQuoteOption.bind(quoteManager));
    
    // 帮助
    document.getElementById('helpBtn').addEventListener('click', () => ui.openModal('helpModal'));
    
    // 批量处理
    document.getElementById('batchProcessBtn').addEventListener('click', batchProcessor.openBatchModal.bind(batchProcessor));
    document.getElementById('batchFileInput').addEventListener('change', batchProcessor.updateBatchFileList.bind(batchProcessor));
    document.getElementById('startBatchBtn').addEventListener('click', batchProcessor.startBatchConversion.bind(batchProcessor));
    document.getElementById('downloadBatchResultBtn').addEventListener('click', batchProcessor.handleBatchDownload.bind(batchProcessor));
    
    // 文本输入监听（同步到分屏）
    document.getElementById('inputText').addEventListener('input', viewManager.syncTextAreas.bind(viewManager));
    
    // 旁白名称同步
    document.getElementById('narratorName').addEventListener('input', (e) => {
        document.getElementById('splitNarratorName').value = e.target.value;
    });
}

// 绑定分屏视图事件
function bindSplitViewEvents() {
    // 格式化和转换
    document.getElementById('formatTextSplitBtn').addEventListener('click', viewManager.formatTextSplit.bind(viewManager));
    document.getElementById('splitConvertBtn').addEventListener('click', converter.updateSplitPreview.bind(converter));
    document.getElementById('splitDownloadBtn').addEventListener('click', fileHandler.downloadSplitResult.bind(fileHandler));
    
    // 自动预览
    document.getElementById('autoPreviewCheckbox').addEventListener('change', (e) => {
        state.autoPreviewEnabled = e.target.checked;
        if (state.autoPreviewEnabled) {
            converter.updateSplitPreview();
        }
    });
    
    // 引号配置
    document.getElementById('splitQuoteConfigBtn').addEventListener('click', quoteManager.openSplitQuoteModal.bind(quoteManager));
    document.getElementById('addSplitCustomQuoteBtn').addEventListener('click', quoteManager.addSplitCustomQuoteOption.bind(quoteManager));
    
    // 旁白名称
    document.getElementById('splitNarratorName').addEventListener('input', (e) => {
        document.getElementById('narratorName').value = e.target.value;
        if (state.autoPreviewEnabled) {
            viewManager.debouncePreview();
        }
    });
    
    // 文本输入监听（用于实时预览）
    document.getElementById('splitInputText').addEventListener('input', () => {
        viewManager.syncTextAreas();
        viewManager.debouncePreview();
    });
}

// 绑定视图切换事件
function bindViewSwitchEvents() {
    // 视图切换按钮
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', viewManager.switchView.bind(viewManager));
    });
    
    // 预览模式切换按钮
    document.querySelectorAll('.preview-mode-btn').forEach(btn => {
        btn.addEventListener('click', viewManager.switchPreviewMode.bind(viewManager));
    });
}

// 绑定模态框事件
function bindModalEvents() {
    // 注意：模态框的关闭按钮在HTML中使用了onclick，已经通过uiUtils.js暴露到全局
}

// DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initializeApp);