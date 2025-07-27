// converter.js - 文本转换核心功能

import { state } from './constants.js';
import { ui } from './uiUtils.js';
import { quoteManager } from './quoteManager.js';
import { dialoguePreview } from './dialoguePreview.js';

export const converter = {
    // 文本转换
    async convertText() {
        const inputText = document.getElementById('inputText').value.trim();
        const narratorName = document.getElementById('narratorName').value || ' ';

        if (!inputText) {
            ui.showStatus('请输入要转换的文本！', 'error');
            return;
        }

        const selectedQuotePairs = quoteManager.getSelectedQuotes();

        try {
            ui.setButtonLoading('convertBtn', true, '转换中...');
            ui.showProgress(10);
            ui.showStatus('正在处理文本...', 'info');

            const response = await axios.post('/api/convert', {
                text: inputText,
                narrator_name: narratorName,
                selected_quote_pairs: selectedQuotePairs,
                character_mapping: state.currentConfig,
                enable_live2d: state.enableLive2D,  // 新增
                costume_mapping: state.currentCostumes  // 新增
            });

            ui.showProgress(100);
            state.currentResult = response.data.result;
            
            document.getElementById('resultContent').textContent = state.currentResult;
            Prism.highlightElement(document.getElementById('resultContent'));
            document.getElementById('resultSection').style.display = 'block';
            
            ui.showStatus('转换完成！', 'success');
            ui.scrollToElement('resultSection');

            setTimeout(() => ui.hideProgress(), 1000);
        } catch (error) {
            ui.showStatus(`转换失败: ${error.response?.data?.error || error.message}`, 'error');
            ui.hideProgress();
        } finally {
            ui.setButtonLoading('convertBtn', false);
        }
    },

    // 更新分屏预览
    async updateSplitPreview() {
        const inputText = document.getElementById('splitInputText').value.trim();
        if (!inputText) {
            document.querySelector('#splitPreviewJson code').textContent = '// 请输入文本以查看预览';
            document.getElementById('splitPreviewDialogue').innerHTML = '<p style="text-align: center; color: #718096;">请输入文本以查看预览</p>';
            return;
        }
        
        // 使用分屏视图中的旁白名称设置
        const narratorName = document.getElementById('splitNarratorName').value || ' ';
        const selectedQuotePairs = quoteManager.getSelectedQuotes();
        
        try {
            const response = await axios.post('/api/convert', {
                text: inputText,
                narrator_name: narratorName,
                selected_quote_pairs: selectedQuotePairs,
                character_mapping: state.currentConfig  // 重要：传递角色映射配置
            });
            
            const jsonResult = response.data.result;
            state.currentResult = jsonResult;
            
            // 更新JSON预览
            document.querySelector('#splitPreviewJson code').textContent = jsonResult;
            Prism.highlightElement(document.querySelector('#splitPreviewJson code'));
            
            // 更新对话预览
            dialoguePreview.updateDialoguePreview(jsonResult, 'splitPreviewDialogue');
            
        } catch (error) {
            const errorMsg = `转换失败: ${error.response?.data?.error || error.message}`;
            document.querySelector('#splitPreviewJson code').textContent = `// ${errorMsg}`;
            document.getElementById('splitPreviewDialogue').innerHTML = `<p style="text-align: center; color: #e53e3e;">${errorMsg}</p>`;
        }
    }
};