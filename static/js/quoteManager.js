// quoteManager.js - 引号管理相关功能

import { state } from './constants.js';
import { ui } from './uiUtils.js';
import { converter } from './converter.js';

export const quoteManager = {
    // 渲染引号选项
    renderQuoteOptions() {
        const container = document.getElementById('quoteOptionsContainer');
        container.innerHTML = '';
        
        if (!state.quotesConfig || !state.quotesConfig.quote_categories) return;

        Object.entries(state.quotesConfig.quote_categories).forEach(([categoryName, chars]) => {
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
    },

    // 获取选中的引号对
    getSelectedQuotes() {
        const selectedPairs = [];
        document.querySelectorAll('.quote-option-checkbox:checked').forEach(checkbox => {
            const openChar = checkbox.dataset.open;
            const closeChar = checkbox.dataset.close;
            if (openChar && closeChar) {
                selectedPairs.push([openChar, closeChar]);
            }
        });
        return selectedPairs;
    },

    // 添加自定义引号选项
    addCustomQuoteOption() {
        const openChar = document.getElementById('customQuoteOpen').value;
        const closeChar = document.getElementById('customQuoteClose').value;

        if (!openChar || !closeChar) {
            ui.showStatus('起始和结束符号都不能为空！', 'error');
            return;
        }
        
        const categoryName = `${openChar}...${closeChar}`;
        const checkboxId = `quote-check-custom-${Date.now()}`;
        
        // 添加到主界面
        this.addCustomQuoteOptionToContainer(document.getElementById('quoteOptionsContainer'), 
                                       checkboxId, categoryName, openChar, closeChar, true);
        
        // 如果分屏引号容器存在，也添加到那里
        const splitContainer = document.getElementById('splitQuoteOptionsContainer');
        if (splitContainer) {
            this.addCustomQuoteOptionToContainer(splitContainer, 
                                           checkboxId + '-split', categoryName, openChar, closeChar, true);
        }

        document.getElementById('customQuoteOpen').value = '';
        document.getElementById('customQuoteClose').value = '';
    },

    // 辅助函数：添加自定义引号选项到指定容器
    addCustomQuoteOptionToContainer(container, checkboxId, categoryName, openChar, closeChar, checked) {
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
    },

    // 打开分屏引号设置模态框
    openSplitQuoteModal() {
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
                if (state.autoPreviewEnabled) {
                    converter.updateSplitPreview();
                }
            });
        });
        
        ui.openModal('splitQuoteModal');
    },

    // 添加分屏自定义引号选项
    addSplitCustomQuoteOption() {
        const openChar = document.getElementById('splitCustomQuoteOpen').value;
        const closeChar = document.getElementById('splitCustomQuoteClose').value;

        if (!openChar || !closeChar) {
            ui.showStatus('起始和结束符号都不能为空！', 'error');
            return;
        }
        
        // 同时添加到主界面和分屏界面
        const categoryName = `${openChar}...${closeChar}`;
        const checkboxId = `quote-check-custom-${Date.now()}`;
        
        // 添加到主界面
        this.addCustomQuoteOptionToContainer(document.getElementById('quoteOptionsContainer'), 
                                       checkboxId, categoryName, openChar, closeChar, true);
        
        // 添加到分屏界面
        this.addCustomQuoteOptionToContainer(document.getElementById('splitQuoteOptionsContainer'), 
                                       checkboxId + '-split', categoryName, openChar, closeChar, true);
        
        document.getElementById('splitCustomQuoteOpen').value = '';
        document.getElementById('splitCustomQuoteClose').value = '';
        
        if (state.autoPreviewEnabled) {
            converter.updateSplitPreview();
        }
    }
};