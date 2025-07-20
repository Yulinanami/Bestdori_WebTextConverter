// dialoguePreview.js - 对话预览相关功能

import { GRADIENTS } from './constants.js';
import { ui } from './uiUtils.js';
import { quoteManager } from './quoteManager.js';
import { converter } from './converter.js';

export const dialoguePreview = {
    // 根据角色ID获取头像渐变色
    getAvatarGradient(id) {
        return GRADIENTS[id % GRADIENTS.length];
    },

    // 更新对话预览
    updateDialoguePreview(jsonStr, containerId) {
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
                    avatar.style.background = this.getAvatarGradient(characterId);
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
    },

    // 显示对话预览模态框
    async showDialoguePreview() {
        const inputText = document.getElementById('inputText').value.trim();
        if (!inputText) {
            ui.showStatus('请先输入要转换的文本！', 'error');
            return;
        }
        
        const narratorName = document.getElementById('narratorName').value || ' ';
        const selectedQuotePairs = quoteManager.getSelectedQuotes();
        
        try {
            const response = await axios.post('/api/convert', {
                text: inputText,
                narrator_name: narratorName,
                selected_quote_pairs: selectedQuotePairs,
                character_mapping: state.currentConfig  // 添加角色映射配置
            });
            
            this.updateDialoguePreview(response.data.result, 'dialogueContainer');
            ui.openModal('dialoguePreviewModal');
            
        } catch (error) {
            ui.showStatus(`预览失败: ${error.response?.data?.error || error.message}`, 'error');
        }
    }
};