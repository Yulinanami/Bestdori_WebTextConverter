// costumeManager.js - 服装管理相关功能

import { state } from './constants.js';
import { ui } from './uiUtils.js';

export const costumeManager = {
    // 默认服装配置
    defaultCostumes: {},
    availableCostumes: {},
    
    // 加载服装配置
    async loadCostumeConfig() {
        try {
            const response = await axios.get('/api/costumes');
            this.availableCostumes = response.data.available_costumes;
            this.defaultCostumes = response.data.default_costumes;
            
            // 尝试从 LocalStorage 加载用户自定义配置
            const savedCostumes = this.loadLocalCostumes();
            if (savedCostumes) {
                state.currentCostumes = savedCostumes;
            } else {
                state.currentCostumes = { ...this.defaultCostumes };
            }
            
            // 加载启用状态
            const enableLive2D = localStorage.getItem('bestdori_enable_live2d');
            state.enableLive2D = enableLive2D === 'true';
            document.getElementById('enableLive2DCheckbox').checked = state.enableLive2D;
            
        } catch (error) {
            console.error('加载服装配置失败:', error);
        }
    },
    
    // 从 LocalStorage 加载服装配置
    loadLocalCostumes() {
        try {
            const saved = localStorage.getItem('bestdori_costume_mapping');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('加载本地服装配置失败:', error);
        }
        return null;
    },
    
    // 保存服装配置到 LocalStorage
    saveLocalCostumes(costumes) {
        try {
            localStorage.setItem('bestdori_costume_mapping', JSON.stringify(costumes));
            return true;
        } catch (error) {
            console.error('保存本地服装配置失败:', error);
            return false;
        }
    },
    
    // 打开服装配置模态框
    async openCostumeModal() {
        await ui.withButtonLoading('costumeConfigBtn', async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            this.renderCostumeList();
            ui.openModal('costumeModal');
        }, '加载配置...');
    },
    
    // 渲染服装列表
    renderCostumeList() {
        const costumeList = document.getElementById('costumeList');
        costumeList.innerHTML = '';
        
        // 按角色ID排序
        const sortedCharacters = Object.entries(state.currentConfig).sort(([, idsA], [, idsB]) => {
            const idA = idsA && idsA.length > 0 ? idsA[0] : Infinity;
            const idB = idsB && idsB.length > 0 ? idsB[0] : Infinity;
            return idA - idB;
        });
        
        sortedCharacters.forEach(([name, ids]) => {
            if (!ids || ids.length === 0) return;
            
            const primaryId = ids[0];
            const availableForCharacter = this.availableCostumes[primaryId] || [];
            const currentCostume = state.currentCostumes[primaryId] || '';
            
            const costumeItem = document.createElement('div');
            costumeItem.className = 'costume-item';
            costumeItem.innerHTML = `
                <div class="costume-character-info">
                    <div class="config-avatar" data-id="${primaryId}">
                        ${primaryId > 0 ? 
                            `<img src="/static/images/avatars/${primaryId}.png" alt="${name}" class="config-avatar-img" onerror="this.style.display='none'; this.parentElement.innerHTML='${name.charAt(0)}'; this.parentElement.classList.add('fallback');">` 
                            : name.charAt(0)
                        }
                    </div>
                    <span class="costume-character-name">${name} (ID: ${primaryId})</span>
                </div>
                <div class="costume-select-wrapper">
                    <select class="form-input costume-select" data-character-id="${primaryId}">
                        <option value="">无服装</option>
                        ${availableForCharacter.map(costume => 
                            `<option value="${costume}" ${costume === currentCostume ? 'selected' : ''}>${costume}</option>`
                        ).join('')}
                        ${currentCostume && !availableForCharacter.includes(currentCostume) ? 
                            `<option value="${currentCostume}" selected>自定义: ${currentCostume}</option>` : ''}
                    </select>
                    <button class="btn btn-secondary btn-sm" onclick="costumeManager.addCustomCostume(${primaryId})">➕</button>
                </div>
            `;
            
            costumeList.appendChild(costumeItem);
        });
    },
    
    // 添加自定义服装
    addCustomCostume(characterId) {
        const customCostume = prompt('请输入自定义服装ID：');
        if (customCostume && customCostume.trim()) {
            state.currentCostumes[characterId] = customCostume.trim();
            this.renderCostumeList();
        }
    },
    
    // 保存服装配置
    async saveCostumes() {
        await ui.withButtonLoading('saveCostumesBtn', async () => {
            const newCostumes = {};
            
            document.querySelectorAll('.costume-select').forEach(select => {
                const characterId = parseInt(select.dataset.characterId);
                const costume = select.value;
                if (costume) {
                    newCostumes[characterId] = costume;
                }
            });
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            if (this.saveLocalCostumes(newCostumes)) {
                state.currentCostumes = newCostumes;
                ui.showStatus('服装配置已保存！', 'success');
                ui.closeModal('costumeModal');
            } else {
                ui.showStatus('服装配置保存失败', 'error');
            }
        }, '保存中...');
    },
    
    // 重置为默认服装
    async resetCostumes() {
        if (confirm('确定要恢复默认服装配置吗？')) {
            await ui.withButtonLoading('resetCostumesBtn', async () => {
                localStorage.removeItem('bestdori_costume_mapping');
                state.currentCostumes = { ...this.defaultCostumes };
                
                await new Promise(resolve => setTimeout(resolve, 300));
                
                this.renderCostumeList();
                ui.showStatus('已恢复默认服装配置', 'success');
            }, '重置中...');
        }
    },
    
    // 导出配置时包含服装配置
    exportWithCostumes(config) {
        return {
            ...config,
            costume_mapping: state.currentCostumes,
            enable_live2d: state.enableLive2D
        };
    },
    
    // 导入配置时处理服装配置
    importCostumes(config) {
        if (config.costume_mapping) {
            state.currentCostumes = config.costume_mapping;
            this.saveLocalCostumes(config.costume_mapping);
        }
        if (typeof config.enable_live2d === 'boolean') {
            state.enableLive2D = config.enable_live2d;
            localStorage.setItem('bestdori_enable_live2d', config.enable_live2d.toString());
            document.getElementById('enableLive2DCheckbox').checked = config.enable_live2d;
        }
    }
};

// 暴露到全局作用域
window.costumeManager = costumeManager;