// costumeManager.js - 服装管理相关功能

import { state } from './constants.js';
import { ui } from './uiUtils.js';
import { configManager } from './configManager.js';

export const costumeManager = {
    // 默认服装配置
    defaultCostumes: {},
    availableCostumes: {},
    mujicaMapping: {},  // 存储 Mujica 成员的真实ID映射

    // 获取显示用的头像ID（处理Mujica特殊映射）
    getAvatarId(characterId) {
        // Mujica成员的ID映射
        const mujicaAvatarMapping = {
            337: 1,  // 三角初华
            338: 2,  // 若叶睦
            339: 3,  // 八幡海铃
            340: 4,  // 祐天寺若麦
            341: 5   // 丰川祥子
        };
        
        // 如果是Mujica成员，返回映射的头像ID
        if (mujicaAvatarMapping[characterId]) {
            return mujicaAvatarMapping[characterId];
        }
        
        // 否则返回原ID
        return characterId;
    },
    
    // 加载服装配置
    async loadCostumeConfig() {
        try {
            const response = await axios.get('/api/costumes');
            this.availableCostumes = response.data.available_costumes;
            this.defaultCostumes = response.data.default_costumes;
            this.mujicaMapping = response.data.mujica_mapping || {};
        
            // 尝试从 LocalStorage 加载用户自定义配置
            const savedCostumes = this.loadLocalCostumes();
            if (savedCostumes) {
                state.currentCostumes = savedCostumes;
            } else {
                state.currentCostumes = { ...this.defaultCostumes };
            }
            
            // 加载用户自定义的可用服装列表
            const savedAvailableCostumes = this.loadLocalAvailableCostumes();
            if (savedAvailableCostumes) {
                // 将保存的列表合并到从服务器获取的列表中。
                // Object.assign 会用 savedAvailableCostumes 中的属性覆盖 this.availableCostumes 中的同名属性。
                // 这确保了用户的修改（包括删除的空列表）能够覆盖默认值。
                Object.assign(this.availableCostumes, savedAvailableCostumes);
            }
            
            // 加载启用状态
            const enableLive2D = localStorage.getItem('bestdori_enable_live2d');
            state.enableLive2D = enableLive2D === 'true';
            document.getElementById('enableLive2DCheckbox').checked = state.enableLive2D;
            
            // 同步到分屏视图（如果存在）
            const splitCheckbox = document.getElementById('splitEnableLive2DCheckbox');
            if (splitCheckbox) {
                splitCheckbox.checked = state.enableLive2D;
            }
            
        } catch (error) {
            console.error('加载服装配置失败:', error);
            ui.showStatus('无法加载服装配置', 'error');
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
    
    // 加载本地自定义角色
    loadLocalCustomCharacters() {
        try {
            const saved = localStorage.getItem('bestdori_custom_characters');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('加载本地自定义角色失败:', error);
        }
        return null;
    },
    
    // 保存自定义角色到本地
    saveLocalCustomCharacters(characters) {
        try {
            localStorage.setItem('bestdori_custom_characters', JSON.stringify(characters));
            return true;
        } catch (error) {
            console.error('保存自定义角色失败:', error);
            return false;
        }
    },
    
    // 加载本地可用服装列表
    loadLocalAvailableCostumes() {
        try {
            const saved = localStorage.getItem('bestdori_available_costumes');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('加载本地可用服装列表失败:', error);
        }
        return null;
    },
    
    // 保存可用服装列表到本地
    saveLocalAvailableCostumes() {
        try {
            // 直接保存整个 availableCostumes 对象。
            // 这个对象已经包含了用户的所有修改（添加、编辑、删除），
            // 所以我们不需要再和默认配置进行比较。
            localStorage.setItem('bestdori_available_costumes', JSON.stringify(this.availableCostumes));
            return true;
        } catch (error) {
            console.error('保存可用服装列表失败:', error);
            return false;
        }
    },
    
    // 获取角色的有效ID（处理 Mujica 特殊情况）
    getEffectiveCharacterId(characterName, primaryId) {
        // 现在不需要特殊处理，直接返回primaryId
        return primaryId;
    },
    // 打开服装配置模态框
    async openCostumeModal() {
        await ui.withButtonLoading('costumeConfigBtn', async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            this.renderCostumeList();
            ui.openModal('costumeModal');
        }, '加载配置...');
    },
    
    // 渲染服装列表（新版本）
    renderCostumeList() {
        const costumeList = document.getElementById('costumeList');
        costumeList.innerHTML = '';
        
        // 获取所有需要显示的角色（来自角色映射）
        const characterEntries = Object.entries(state.currentConfig).sort(([, idsA], [, idsB]) => {
            const idA = idsA && idsA.length > 0 ? idsA[0] : Infinity;
            const idB = idsB && idsB.length > 0 ? idsB[0] : Infinity;
            return idA - idB;
        });
        
        characterEntries.forEach(([name, ids]) => {
            if (!ids || ids.length === 0) return;
            
            const primaryId = ids[0];
            const effectiveId = this.getEffectiveCharacterId(name, primaryId);
            const avatarId = this.getAvatarId(primaryId);
            
            // 获取该角色的可用服装列表
            const availableForCharacter = this.availableCostumes[effectiveId] || [];
            const currentCostume = state.currentCostumes[effectiveId] || '';
            
            const costumeItem = document.createElement('div');
            costumeItem.className = 'costume-config-item';
            
            // 如果是 Mujica 成员，添加特殊标记
            const isMujica = effectiveId !== primaryId;
            if (isMujica) {
                costumeItem.style.background = '#fef3c7';  // 淡黄色背景
                costumeItem.title = '此角色暂时使用替代ID显示，但服装配置独立';
            }
            
            costumeItem.innerHTML = `
            <div class="costume-item-header">
                <div class="costume-character-info">
                    <div class="config-avatar" data-id="${primaryId}">
                        ${avatarId > 0 ? 
                            `<img src="/static/images/avatars/${avatarId}.png" alt="${name}" class="config-avatar-img" onerror="this.style.display='none'; this.parentElement.innerHTML='${name.charAt(0)}'; this.parentElement.classList.add('fallback');">` 
                            : name.charAt(0)
                        }
                    </div>
                    <span class="costume-character-name">
                        ${name} (ID: ${primaryId})
                    </span>
                </div>
                    <div class="costume-actions">
                        <button class="btn btn-sm btn-secondary" onclick="costumeManager.toggleCostumeDetails(${effectiveId})">
                            <span id="toggle-${effectiveId}">▼</span> 服装管理
                        </button>
                    </div>
                </div>
                
                <div id="costume-details-${effectiveId}" class="costume-details" style="display: none;">
                    <div class="costume-current">
                        <label>当前服装：</label>
                        <select class="form-input costume-select" data-character-id="${effectiveId}">
                            <option value="">无服装</option>
                            ${availableForCharacter.map(costume => 
                                `<option value="${costume}" ${costume === currentCostume ? 'selected' : ''}>${costume}</option>`
                            ).join('')}
                        </select>
                    </div>
                    
                    <div class="costume-available-list">
                        <div class="costume-list-header">
                            <label>可用服装列表：</label>
                            <button class="btn btn-sm btn-secondary" onclick="costumeManager.addNewCostume(${effectiveId})">
                                ➕ 添加服装
                            </button>
                        </div>
                        <div id="costume-list-${effectiveId}" class="costume-list-items">
                            ${this.renderCostumeListItems(effectiveId, availableForCharacter)}
                        </div>
                    </div>
                </div>
            `;
            
            costumeList.appendChild(costumeItem);
            
            // 绑定当前服装选择变化事件
            const select = costumeItem.querySelector('.costume-select');
            select.addEventListener('change', (e) => {
                state.currentCostumes[effectiveId] = e.target.value;
            });
        }); 
    },
    
    // 渲染服装列表项
    renderCostumeListItems(characterId, costumes) {
        if (!costumes || costumes.length === 0) {
            return '<div class="empty-costume-list">暂无可用服装</div>';
        }
        
        return costumes.map((costume, index) => `
            <div class="costume-list-item">
                <span>${costume}</span>
                <div class="costume-item-actions">
                    <button class="btn btn-sm" onclick="costumeManager.editCostume(${characterId}, ${index}, '${costume}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="costumeManager.deleteCostume(${characterId}, ${index})">🗑️</button>
                </div>
            </div>
        `).join('');
    },
    
    // 切换服装详情显示
    toggleCostumeDetails(characterId) {
        const details = document.getElementById(`costume-details-${characterId}`);
        const toggle = document.getElementById(`toggle-${characterId}`);
        
        if (details.style.display === 'none') {
            details.style.display = 'block';
            toggle.textContent = '▲';
        } else {
            details.style.display = 'none';
            toggle.textContent = '▼';
        }
    },
    
    // 添加新服装
    addNewCostume(characterId) {
        const costumeId = prompt('请输入新的服装ID：');
        if (costumeId && costumeId.trim()) {
            const trimmedId = costumeId.trim();
            
            // 确保该角色有服装列表
            if (!this.availableCostumes[characterId]) {
                this.availableCostumes[characterId] = [];
            }
            
            // 检查是否已存在
            if (this.availableCostumes[characterId].includes(trimmedId)) {
                ui.showStatus('该服装ID已存在', 'error');
                return;
            }
            
            // 添加服装
            this.availableCostumes[characterId].push(trimmedId);
            
            // 保存到本地
            this.saveLocalAvailableCostumes();
            
            // 更新UI
            this.updateCostumeListUI(characterId);
            ui.showStatus(`已添加服装: ${trimmedId}`, 'success');
        }
    },
    
    // 编辑服装
    editCostume(characterId, index, oldCostume) {
        const newCostume = prompt('编辑服装ID：', oldCostume);
        if (newCostume && newCostume.trim() && newCostume !== oldCostume) {
            const trimmedId = newCostume.trim();
            
            // 检查是否已存在
            if (this.availableCostumes[characterId].includes(trimmedId)) {
                ui.showStatus('该服装ID已存在', 'error');
                return;
            }
            
            // 更新服装列表
            this.availableCostumes[characterId][index] = trimmedId;
            
            // 如果当前选择的是这个服装，也要更新
            if (state.currentCostumes[characterId] === oldCostume) {
                state.currentCostumes[characterId] = trimmedId;
            }
            
            // 保存到本地
            this.saveLocalAvailableCostumes();
            
            // 更新UI
            this.updateCostumeListUI(characterId);
            ui.showStatus('服装ID已更新', 'success');
        }
    },
    
    // 删除服装
    deleteCostume(characterId, index) {
        const costume = this.availableCostumes[characterId][index];
        if (confirm(`确定要删除服装 "${costume}" 吗？`)) {
            // 从列表中移除
            this.availableCostumes[characterId].splice(index, 1);
            
            // 如果当前选择的是这个服装，清空选择
            if (state.currentCostumes[characterId] === costume) {
                state.currentCostumes[characterId] = '';
            }
            
            // 保存到本地
            this.saveLocalAvailableCostumes();
            
            // 更新UI
            this.updateCostumeListUI(characterId);
            ui.showStatus('服装已删除', 'success');
        }
    },
    
    // 删除角色
    deleteCharacter(characterName) {
        if (!this.customCharacters[characterName]) {
            ui.showStatus('只能删除自定义角色', 'error');
            return;
        }
        
        if (confirm(`确定要删除角色 "${characterName}" 吗？这将同时删除该角色的所有服装配置。`)) {
            const characterId = state.currentConfig[characterName][0];
            
            // 从配置中删除
            delete state.currentConfig[characterName];
            delete this.customCharacters[characterName];
            
            // 删除服装配置
            delete state.currentCostumes[characterId];
            delete this.availableCostumes[characterId];
            
            // 保存更改
            this.saveLocalCustomCharacters(this.customCharacters);
            this.saveLocalCostumes(state.currentCostumes);
            this.saveLocalAvailableCostumes();
            
            // 重新渲染
            this.renderCostumeList();
            ui.showStatus(`已删除角色: ${characterName}`, 'success');
        }
    },
    
    // 更新服装列表UI
    updateCostumeListUI(characterId) {
        // 更新服装列表
        const listContainer = document.getElementById(`costume-list-${characterId}`);
        if (listContainer) {
            listContainer.innerHTML = this.renderCostumeListItems(characterId, this.availableCostumes[characterId]);
        }
        
        // 更新选择框
        const select = document.querySelector(`.costume-select[data-character-id="${characterId}"]`);
        if (select) {
            const currentValue = select.value;
            const availableForCharacter = this.availableCostumes[characterId] || [];
            
            select.innerHTML = `
                <option value="">无服装</option>
                ${availableForCharacter.map(costume => 
                    `<option value="${costume}" ${costume === currentValue ? 'selected' : ''}>${costume}</option>`
                ).join('')}
            `;
        }
    },
    
    // 添加新角色
    addNewCharacter() {
        const characterName = prompt('请输入新角色名称：');
        if (!characterName || !characterName.trim()) return;
        
        const characterIdStr = prompt('请输入角色ID（必须是数字）：');
        if (!characterIdStr || !characterIdStr.trim()) return;
        
        const characterId = parseInt(characterIdStr);
        if (isNaN(characterId)) {
            ui.showStatus('角色ID必须是数字', 'error');
            return;
        }
        
        // 检查名称是否已存在
        if (state.currentConfig[characterName]) {
            ui.showStatus('该角色名称已存在', 'error');
            return;
        }
        
        // 检查ID是否已被使用
        const isIdUsed = Object.values(state.currentConfig).some(ids => ids.includes(characterId));
        if (isIdUsed) {
            ui.showStatus('该角色ID已被使用', 'error');
            return;
        }
        
        // 添加到角色映射
        state.currentConfig[characterName] = [characterId];
        this.customCharacters[characterName] = [characterId];
        
        // 初始化空的服装列表
        this.availableCostumes[characterId] = [];
        state.currentCostumes[characterId] = '';
        
        // 保存 - 需要添加保存角色映射
        configManager.saveLocalConfig(state.currentConfig);  // 添加这一行
        this.saveLocalCustomCharacters(this.customCharacters);
        this.saveLocalAvailableCostumes();
        
        // 重新渲染
        this.renderCostumeList();
        ui.showStatus(`已添加新角色: ${characterName} (ID: ${characterId})`, 'success');
    },
    
    // 保存服装配置
    async saveCostumes() {
        await ui.withButtonLoading('saveCostumesBtn', async () => {
            // 收集所有服装选择
            const newCostumes = {};
            
            document.querySelectorAll('.costume-select').forEach(select => {
                const characterId = parseInt(select.dataset.characterId);
                const costume = select.value;
                if (costume) {
                    newCostumes[characterId] = costume;
                }
            });
            
            console.log('保存的服装配置:', newCostumes);
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            if (this.saveLocalCostumes(newCostumes)) {
                state.currentCostumes = newCostumes;
                // 同时保存其他相关配置
                this.saveLocalAvailableCostumes();
                this.saveLocalCustomCharacters(this.customCharacters);
                
                ui.showStatus('服装配置已保存！', 'success');
                ui.closeModal('costumeModal');
            } else {
                ui.showStatus('服装配置保存失败', 'error');
            }
        }, '保存中...');
    },
    
    // 重置为默认服装
    async resetCostumes() {
        if (confirm('确定要恢复默认服装配置吗？这将清除所有自定义服装设置和自定义角色。')) {
            await ui.withButtonLoading('resetCostumesBtn', async () => {
                // 清除本地存储
                localStorage.removeItem('bestdori_costume_mapping');
                localStorage.removeItem('bestdori_available_costumes');
                
                // 重新加载默认配置
                state.currentCostumes = { ...this.defaultCostumes };
                
                // 重新从服务器加载可用服装列表
                const response = await axios.get('/api/costumes');
                this.availableCostumes = response.data.available_costumes;
                
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
            available_costumes: this.availableCostumes,
            enable_live2d: state.enableLive2D
        };
    },
    
    // 导入配置时处理服装配置
    importCostumes(config) {
        if (config.costume_mapping) {
            state.currentCostumes = config.costume_mapping;
            this.saveLocalCostumes(config.costume_mapping);
        }
        
        // 导入可用服装列表
        if (config.available_costumes) {
            this.availableCostumes = { ...this.availableCostumes, ...config.available_costumes };
            this.saveLocalAvailableCostumes();
        }
        
        if (typeof config.enable_live2d === 'boolean') {
            state.enableLive2D = config.enable_live2d;
            localStorage.setItem('bestdori_enable_live2d', config.enable_live2d.toString());
            
            // 更新主视图开关
            const mainCheckbox = document.getElementById('enableLive2DCheckbox');
            if (mainCheckbox) {
                mainCheckbox.checked = config.enable_live2d;
            }
            
            // 更新分屏视图开关
            const splitCheckbox = document.getElementById('splitEnableLive2DCheckbox');
            if (splitCheckbox) {
                splitCheckbox.checked = config.enable_live2d;
            }
        }
    }
};

// 暴露到全局作用域（因为 HTML 中的 onclick 需要）
window.costumeManager = costumeManager;