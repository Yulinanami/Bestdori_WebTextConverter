// dialoguePreview.js - 对话预览相关功能

import { GRADIENTS, state } from './constants.js';
import { ui } from './uiUtils.js';
import { quoteManager } from './quoteManager.js';

export const dialoguePreview = {
    // 获取角色头像路径
    getCharacterAvatar(characterId) {
        // 如果有角色ID，使用对应的头像
        if (characterId && characterId > 0) {
            return `/static/images/avatars/${characterId}.png`;
        }
        // 默认头像或返回null
        return null;
    },

    // 根据角色ID获取头像渐变色（作为备用方案）
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
            
            // 过滤并处理actions
            let dialogueIndex = 0;
            data.actions.forEach((action) => {
                // 只处理type为"talk"的action
                if (action.type !== 'talk') {
                    return;
                }
                
                // 检查是否为旁白
                const isNarrator = !action.name || action.name.trim() === '' || action.name === ' ';
                
                // 如果是旁白但没有内容，跳过
                if (isNarrator && (!action.body || action.body.trim() === '')) {
                    return;
                }
                
                const dialogueItem = document.createElement('div');
                dialogueItem.className = `dialogue-item ${isNarrator ? 'narrator' : ''}`;
                dialogueItem.style.animationDelay = `${dialogueIndex * 0.05}s`;
                
                if (!isNarrator) {
                    const characterId = action.characters && action.characters[0] ? action.characters[0] : 0;
                    const avatarPath = this.getCharacterAvatar(characterId);
                    
                    // 创建头像容器
                    const avatar = document.createElement('div');
                    avatar.className = 'dialogue-avatar';
                    
                    if (avatarPath && characterId > 0) {
                        // 使用角色头像图片
                        const img = document.createElement('img');
                        img.src = avatarPath;
                        img.alt = action.name;
                        img.className = 'avatar-img';
                        
                        // 添加加载状态
                        avatar.classList.add('loading');
                        
                        img.onload = () => {
                            // 图片加载成功，移除加载状态
                            avatar.classList.remove('loading');
                        };
                        
                        img.onerror = () => {
                            // 图片加载失败时的回退处理
                            avatar.classList.remove('loading');
                            avatar.innerHTML = action.name.charAt(0);
                            avatar.style.background = this.getAvatarGradient(characterId);
                            avatar.classList.add('fallback');
                        };
                        
                        avatar.appendChild(img);
                    } else {
                        // 没有头像时使用文字和渐变背景
                        avatar.textContent = action.name.charAt(0);
                        avatar.style.background = this.getAvatarGradient(characterId);
                        avatar.classList.add('fallback');
                    }
                    
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
                
                // 增加对话索引
                dialogueIndex++;
            });
            
            // 如果没有任何对话内容被添加
            if (dialogueIndex === 0) {
                container.innerHTML = '<p style="text-align: center; color: #718096;">没有对话内容</p>';
            }
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
        
        await ui.withButtonLoading('previewModeBtn', async () => {
            const narratorName = document.getElementById('narratorName').value || ' ';
            const selectedQuotePairs = quoteManager.getSelectedQuotes();
            
            try {
                const response = await axios.post('/api/convert', {
                    text: inputText,
                    narrator_name: narratorName,
                    selected_quote_pairs: selectedQuotePairs,
                    character_mapping: state.currentConfig
                });
                
                this.updateDialoguePreview(response.data.result, 'dialogueContainer');
                ui.openModal('dialoguePreviewModal');
                
            } catch (error) {
                ui.showStatus(`预览失败: ${error.response?.data?.error || error.message}`, 'error');
            }
        }, '生成预览...');
    }
};