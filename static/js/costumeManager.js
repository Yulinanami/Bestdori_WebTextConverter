// costumeManager.js - 服装管理相关功能

import { state } from './constants.js';
import { ui } from './uiUtils.js';
import { configManager } from './configManager.js';

export const costumeManager = {
    // 默认服装配置
    defaultCostumes: {},
    defaultAvailableCostumes: {}, // 存储原始的基于ID的可用服装
    availableCostumes: {},        // 改为基于角色名称的可用服装
    mujicaMapping: {},
    // 添加临时存储，用于存储未保存的更改
    tempCostumeChanges: {},
    originalCostumes: {}, // 存储打开模态框时的原始状态

    // 生成角色的唯一标识符（使用角色名称）
    getCharacterKey(characterName) {
        return characterName;
    },

    // 生成DOM安全的ID（处理特殊字符）
    getSafeDomId(characterName) {
        return characterName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
    },

    // 获取显示用的头像ID
    getAvatarId(characterId) {
        const mujicaAvatarMapping = {
            337: 1,
            338: 2,
            339: 3,
            340: 4,
            341: 5
        };
        
        return mujicaAvatarMapping[characterId] || characterId;
    },

    // 转换可用服装列表为基于角色名称的映射
    convertAvailableCostumesToNameBased() {
        const nameBased = {};
        
        Object.entries(state.currentConfig).forEach(([name, ids]) => {
            if (ids && ids.length > 0) {
                const primaryId = ids[0];
                const characterKey = this.getCharacterKey(name);
                
                // 为每个角色创建独立的服装列表副本
                if (this.defaultAvailableCostumes[primaryId]) {
                    nameBased[characterKey] = [...this.defaultAvailableCostumes[primaryId]];
                } else {
                    nameBased[characterKey] = [];
                }
                
                // 确保默认服装在列表中
                const defaultCostume = this.defaultCostumes[primaryId];
                if (defaultCostume && !nameBased[characterKey].includes(defaultCostume)) {
                    nameBased[characterKey].push(defaultCostume);
                }
            }
        });
        
        return nameBased;
    },

    // 转换默认服装配置为基于角色名称的映射
    convertDefaultCostumesToNameBased() {
        const nameBased = {};
        
        Object.entries(state.currentConfig).forEach(([name, ids]) => {
            if (ids && ids.length > 0) {
                const primaryId = ids[0];
                const characterKey = this.getCharacterKey(name);
                
                // 获取该ID的默认服装
                const defaultCostume = this.defaultCostumes[primaryId];
                
                if (defaultCostume) {
                    // 确保默认服装在可用列表中
                    const availableList = this.defaultAvailableCostumes[primaryId] || [];
                    if (availableList.includes(defaultCostume)) {
                        nameBased[characterKey] = defaultCostume;
                    } else {
                        // 如果默认服装不在可用列表中，使用第一个可用的
                        nameBased[characterKey] = availableList[0] || '';
                    }
                } else {
                    nameBased[characterKey] = '';
                }
            }
        });
        
        return nameBased;
    },
    
    // 加载服装配置
    async loadCostumeConfig() {
        try {
            const response = await axios.get('/api/costumes');
            this.defaultAvailableCostumes = response.data.available_costumes; // 保存原始数据
            this.defaultCostumes = response.data.default_costumes;
            
            // 获取并存储内置角色名称
            const configResponse = await axios.get('/api/config');
            this.builtInCharacters = new Set(Object.keys(configResponse.data.character_mapping));
            
            console.log('内置角色列表:', Array.from(this.builtInCharacters));

            console.log('加载的默认服装配置:', this.defaultCostumes);
            console.log('加载的可用服装列表:', this.defaultAvailableCostumes);
        
            // 加载用户自定义配置
            const savedCostumes = this.loadLocalCostumes();
            if (savedCostumes) {
                state.currentCostumes = savedCostumes;
            } else {
                state.currentCostumes = this.convertDefaultCostumesToNameBased();
            }
            
            // 加载基于角色名称的可用服装列表
            const savedAvailableCostumes = this.loadLocalAvailableCostumes();
            if (savedAvailableCostumes) {
                this.availableCostumes = savedAvailableCostumes;
            } else {
                // 转换默认的可用服装为基于角色名称的格式
                this.availableCostumes = this.convertAvailableCostumesToNameBased();
            }
            
            // 加载Live2D启用状态
            const enableLive2D = localStorage.getItem('bestdori_enable_live2d');
            state.enableLive2D = enableLive2D === 'true';
            document.getElementById('enableLive2DCheckbox').checked = state.enableLive2D;
            
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
            const saved = localStorage.getItem('bestdori_costume_mapping_v2');
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
            localStorage.setItem('bestdori_costume_mapping_v2', JSON.stringify(costumes));
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
            const saved = localStorage.getItem('bestdori_available_costumes_v2'); // 使用新版本
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('加载本地可用服装列表失败:', error);
        }
        return null;
    },
    
    // 修改保存可用服装列表的方法，添加验证
    saveLocalAvailableCostumes() {
        try {
            // 验证数据完整性
            const hasValidData = Object.keys(this.availableCostumes).length > 0 &&
                                Object.values(this.availableCostumes).some(list => Array.isArray(list));
            
            if (!hasValidData) {
                console.warn('尝试保存空的可用服装列表，操作已取消');
                return false;
            }
            
            localStorage.setItem('bestdori_available_costumes_v2', JSON.stringify(this.availableCostumes));
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
            
            // 保存当前状态作为原始状态
            this.originalCostumes = JSON.parse(JSON.stringify(state.currentCostumes));
            this.tempCostumeChanges = JSON.parse(JSON.stringify(state.currentCostumes));
            
            this.renderCostumeList();
            ui.openModal('costumeModal');
        }, '加载配置...');
    },
    
    // 修改渲染服装列表的方法
    renderCostumeList() {
        const costumeList = document.getElementById('costumeList');
        costumeList.innerHTML = '';
        
        const characterEntries = Object.entries(state.currentConfig).sort(([, idsA], [, idsB]) => {
            const idA = idsA && idsA.length > 0 ? idsA[0] : Infinity;
            const idB = idsB && idsB.length > 0 ? idsB[0] : Infinity;
            return idA - idB;
        });
        
        characterEntries.forEach(([name, ids]) => {
            if (!ids || ids.length === 0) return;
            
            const primaryId = ids[0];
            const characterKey = this.getCharacterKey(name);
            const safeDomId = this.getSafeDomId(name);
            const avatarId = this.getAvatarId(primaryId);
            
            // 使用临时存储中的值
            const availableForCharacter = this.availableCostumes[characterKey] || [];
            const currentCostume = this.tempCostumeChanges[characterKey] || '';
            
            const costumeItem = document.createElement('div');
            costumeItem.className = 'costume-config-item';
            
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
                    <button class="btn btn-sm btn-secondary" onclick="costumeManager.toggleCostumeDetails('${safeDomId}')">
                        <span id="toggle-${safeDomId}">▼</span> 服装管理
                    </button>
                </div>
            </div>
            
            <div id="costume-details-${safeDomId}" class="costume-details" style="display: none;">
                <div class="costume-current">
                    <label>当前服装：</label>
                    <select class="form-input costume-select" data-character-key="${characterKey}">
                        <option value="">无服装</option>
                        ${availableForCharacter.map(costume => 
                            `<option value="${costume}" ${costume === currentCostume ? 'selected' : ''}>${costume}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div class="costume-available-list">
                    <div class="costume-list-header">
                        <label>可用服装列表：</label>
                        <button class="btn btn-sm btn-secondary" onclick="costumeManager.addNewCostume('${characterKey}', '${safeDomId}')">
                            ➕ 添加服装
                        </button>
                    </div>
                    <div id="costume-list-${safeDomId}" class="costume-list-items">
                        ${this.renderCostumeListItems(characterKey, availableForCharacter, safeDomId)}
                    </div>
                </div>
            </div>
            `;
            
            costumeList.appendChild(costumeItem);
            
            // 修改：只更新临时存储，不直接修改state
            const select = costumeItem.querySelector('.costume-select');
            select.addEventListener('change', (e) => {
                const key = e.target.dataset.characterKey;
                this.tempCostumeChanges[key] = e.target.value;
            });
        }); 
    },
    
    // 渲染服装列表项
    renderCostumeListItems(characterKey, costumes, safeDomId) {
        if (!costumes || costumes.length === 0) {
            return '<div class="empty-costume-list">暂无可用服装</div>';
        }
        
        return costumes.map((costume, index) => `
            <div class="costume-list-item">
                <span>${costume}</span>
                <div class="costume-item-actions">
                    <button class="btn btn-sm" onclick="costumeManager.editCostume('${characterKey}', ${index}, '${costume}', '${safeDomId}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="costumeManager.deleteCostume('${characterKey}', ${index}, '${safeDomId}')">🗑️</button>
                </div>
            </div>
        `).join('');
    },
    
    // 切换服装详情显示
    toggleCostumeDetails(safeDomId) {
        const details = document.getElementById(`costume-details-${safeDomId}`);
        const toggle = document.getElementById(`toggle-${safeDomId}`);
        
        if (details.style.display === 'none') {
            details.style.display = 'block';
            toggle.textContent = '▲';
        } else {
            details.style.display = 'none';
            toggle.textContent = '▼';
        }
    },
    
    // 添加新服装（基于角色名称）
    addNewCostume(characterKey, safeDomId) {
        const costumeId = prompt('请输入新的服装ID：');
        if (costumeId && costumeId.trim()) {
            const trimmedId = costumeId.trim();
            
            // 确保该角色有服装列表
            if (!this.availableCostumes[characterKey]) {
                this.availableCostumes[characterKey] = [];
            }
            
            // 检查是否已存在
            if (this.availableCostumes[characterKey].includes(trimmedId)) {
                ui.showStatus('该服装ID已存在', 'error');
                return;
            }
            
            // 添加服装
            this.availableCostumes[characterKey].push(trimmedId);
            
            // 保存到本地
            this.saveLocalAvailableCostumes();
            
            // 更新UI
            this.updateCostumeListUI(characterKey, safeDomId);
            ui.showStatus(`已添加服装: ${trimmedId}`, 'success');
        }
    },
    
    // 编辑服装（基于角色名称）
    editCostume(characterKey, index, oldCostume, safeDomId) {
        const newCostume = prompt('编辑服装ID：', oldCostume);
        if (newCostume && newCostume.trim() && newCostume !== oldCostume) {
            const trimmedId = newCostume.trim();
            
            // 检查是否已存在
            if (this.availableCostumes[characterKey].includes(trimmedId)) {
                ui.showStatus('该服装ID已存在', 'error');
                return;
            }
            
            // 更新服装列表
            this.availableCostumes[characterKey][index] = trimmedId;
            
            // 如果当前选择的是这个服装，也要更新
            if (state.currentCostumes[characterKey] === oldCostume) {
                state.currentCostumes[characterKey] = trimmedId;
            }
            
            // 保存到本地
            this.saveLocalAvailableCostumes();
            
            // 更新UI
            this.updateCostumeListUI(characterKey, safeDomId);
            ui.showStatus('服装ID已更新', 'success');
        }
    },
    
    // 删除服装（基于角色名称）
    deleteCostume(characterKey, index, safeDomId) {
        const costume = this.availableCostumes[characterKey][index];
        if (confirm(`确定要删除服装 "${costume}" 吗？`)) {
            // 从列表中移除
            this.availableCostumes[characterKey].splice(index, 1);
            
            // 如果当前选择的是这个服装，清空选择
            if (state.currentCostumes[characterKey] === costume) {
                state.currentCostumes[characterKey] = '';
            }
            
            // 保存到本地
            this.saveLocalAvailableCostumes();
            
            // 更新UI
            this.updateCostumeListUI(characterKey, safeDomId);
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
    
    // 更新服装列表UI（基于角色名称）
    updateCostumeListUI(characterKey, safeDomId) {
        // 更新服装列表
        const listContainer = document.getElementById(`costume-list-${safeDomId}`);
        if (listContainer) {
            const costumes = this.availableCostumes[characterKey] || [];
            listContainer.innerHTML = this.renderCostumeListItems(characterKey, costumes, safeDomId);
        }
        
        // 更新选择框
        const costumeDetailsContainer = document.getElementById(`costume-details-${safeDomId}`);
        if (costumeDetailsContainer) {
            const select = costumeDetailsContainer.querySelector('.costume-select');
            if (select && select.dataset.characterKey === characterKey) {
                const currentValue = state.currentCostumes[characterKey] || '';
                const availableForCharacter = this.availableCostumes[characterKey] || [];
                
                select.innerHTML = `
                    <option value="">无服装</option>
                    ${availableForCharacter.map(costume => 
                        `<option value="${costume}" ${costume === currentValue ? 'selected' : ''}>${costume}</option>`
                    ).join('')}
                `;
                
                select.value = currentValue;
            }
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
            // 使用临时存储中的值
            const newCostumes = { ...this.tempCostumeChanges };
            
            console.log('保存的服装配置:', newCostumes);
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            if (this.saveLocalCostumes(newCostumes)) {
                // 只有在成功保存后才更新state
                state.currentCostumes = newCostumes;
                this.saveLocalAvailableCostumes();
                
                ui.showStatus('服装配置已保存！', 'success');
                ui.closeModal('costumeModal');
            } else {
                ui.showStatus('服装配置保存失败', 'error');
            }
        }, '保存中...');
    },
    
    // 重置为默认服装
    async resetCostumes() {
        if (confirm('确定要恢复默认服装配置吗？这将只重置内置角色的服装设置，自定义角色的服装配置将保留。')) {
            await ui.withButtonLoading('resetCostumesBtn', async () => {
                try {
                    // 保存当前自定义角色的服装配置
                    const customCharacterCostumes = {};
                    const customCharacterAvailableCostumes = {};
                    
                    // 遍历当前配置，保存自定义角色的服装
                    Object.entries(state.currentConfig).forEach(([name, ids]) => {
                        if (!this.builtInCharacters.has(name)) {
                            // 这是自定义角色，保存其配置
                            const characterKey = this.getCharacterKey(name);
                            if (state.currentCostumes[characterKey] !== undefined) {
                                customCharacterCostumes[characterKey] = state.currentCostumes[characterKey];
                            }
                            if (this.availableCostumes[characterKey]) {
                                customCharacterAvailableCostumes[characterKey] = [...this.availableCostumes[characterKey]];
                            }
                        }
                    });
                    
                    console.log('保留的自定义角色服装配置:', customCharacterCostumes);
                    
                    // 清除本地存储
                    localStorage.removeItem('bestdori_costume_mapping_v2');
                    localStorage.removeItem('bestdori_available_costumes_v2');
                    
                    // 重新从服务器获取默认配置
                    const response = await axios.get('/api/costumes');
                    this.defaultAvailableCostumes = response.data.available_costumes;
                    this.defaultCostumes = response.data.default_costumes;
                    
                    // 重新生成基于角色名称的配置（只包含内置角色）
                    state.currentCostumes = this.convertDefaultCostumesToNameBasedWithCustom(customCharacterCostumes);
                    this.availableCostumes = this.convertAvailableCostumesToNameBasedWithCustom(customCharacterAvailableCostumes);
                    
                    // 更新临时存储
                    this.tempCostumeChanges = JSON.parse(JSON.stringify(state.currentCostumes));
                    this.originalCostumes = JSON.parse(JSON.stringify(state.currentCostumes));
                    
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    // 重新渲染列表
                    this.renderCostumeList();
                    
                    // 强制更新所有选择框的值
                    this.forceUpdateAllSelects();
                    
                    ui.showStatus('已恢复内置角色的默认服装配置（自定义角色配置已保留）', 'success');
                } catch (error) {
                    console.error('重置服装配置失败:', error);
                    ui.showStatus('重置服装配置失败', 'error');
                }
            }, '重置中...');
        }
    },

    convertDefaultCostumesToNameBasedWithCustom(customCharacterCostumes) {
        const nameBased = {};
        
        Object.entries(state.currentConfig).forEach(([name, ids]) => {
            if (ids && ids.length > 0) {
                const characterKey = this.getCharacterKey(name);
                
                if (this.builtInCharacters.has(name)) {
                    // 内置角色，使用默认服装
                    const primaryId = ids[0];
                    const defaultCostume = this.defaultCostumes[primaryId];
                    
                    if (defaultCostume) {
                        const availableList = this.defaultAvailableCostumes[primaryId] || [];
                        if (availableList.includes(defaultCostume)) {
                            nameBased[characterKey] = defaultCostume;
                        } else {
                            nameBased[characterKey] = availableList[0] || '';
                        }
                    } else {
                        nameBased[characterKey] = '';
                    }
                } else {
                    // 自定义角色，保留原有配置
                    if (customCharacterCostumes[characterKey] !== undefined) {
                        nameBased[characterKey] = customCharacterCostumes[characterKey];
                    } else {
                        nameBased[characterKey] = '';
                    }
                }
            }
        });
        
        return nameBased;
    },

    convertAvailableCostumesToNameBasedWithCustom(customCharacterAvailableCostumes) {
        const nameBased = {};
        
        Object.entries(state.currentConfig).forEach(([name, ids]) => {
            if (ids && ids.length > 0) {
                const characterKey = this.getCharacterKey(name);
                
                if (this.builtInCharacters.has(name)) {
                    // 内置角色，使用默认可用服装列表
                    const primaryId = ids[0];
                    if (this.defaultAvailableCostumes[primaryId]) {
                        nameBased[characterKey] = [...this.defaultAvailableCostumes[primaryId]];
                    } else {
                        nameBased[characterKey] = [];
                    }
                    
                    // 确保默认服装在列表中
                    const defaultCostume = this.defaultCostumes[primaryId];
                    if (defaultCostume && !nameBased[characterKey].includes(defaultCostume)) {
                        nameBased[characterKey].push(defaultCostume);
                    }
                } else {
                    // 自定义角色，保留原有列表
                    if (customCharacterAvailableCostumes[characterKey]) {
                        nameBased[characterKey] = [...customCharacterAvailableCostumes[characterKey]];
                    } else {
                        nameBased[characterKey] = [];
                    }
                }
            }
        });
        
        return nameBased;
    },

    forceUpdateAllSelects() {
        // 遍历所有服装选择框并更新其值
        document.querySelectorAll('.costume-select').forEach(select => {
            const characterKey = select.dataset.characterKey;
            const defaultValue = state.currentCostumes[characterKey] || '';
            
            // 确保选项存在
            const hasOption = Array.from(select.options).some(option => option.value === defaultValue);
            
            if (hasOption) {
                select.value = defaultValue;
            } else {
                select.value = '';
            }
        });
    },

    // 添加取消/关闭模态框时的处理
    cancelCostumeChanges() {
        // 恢复原始状态
        state.currentCostumes = { ...this.originalCostumes };
        this.tempCostumeChanges = {};
        ui.closeModal('costumeModal');
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

        // 如果配置中包含内置角色信息，更新它
        if (config.built_in_characters) {
            this.builtInCharacters = new Set(config.built_in_characters);
        }
        
        // 导入可用服装列表（新增）
        if (config.available_costumes) {
            // 如果是基于角色名称的格式（v1.2+），直接使用
            this.availableCostumes = config.available_costumes;
            this.saveLocalAvailableCostumes();
        } else if (config.costume_mapping && !config.available_costumes) {
            // 兼容旧版本：如果只有costume_mapping，需要重建available_costumes
            this.availableCostumes = this.convertAvailableCostumesToNameBased();
            this.saveLocalAvailableCostumes();
        }
        
        if (typeof config.enable_live2d === 'boolean') {
            state.enableLive2D = config.enable_live2d;
            localStorage.setItem('bestdori_enable_live2d', config.enable_live2d.toString());
            
            const mainCheckbox = document.getElementById('enableLive2DCheckbox');
            if (mainCheckbox) {
                mainCheckbox.checked = config.enable_live2d;
            }
            
            const splitCheckbox = document.getElementById('splitEnableLive2DCheckbox');
            if (splitCheckbox) {
                splitCheckbox.checked = config.enable_live2d;
            }
        }
    },
    
    // 转换导入的基于ID的可用服装为基于名称的格式
    convertImportedAvailableCostumes(idBasedCostumes) {
        const nameBased = {};
        Object.entries(state.currentConfig).forEach(([name, ids]) => {
            if (ids && ids.length > 0) {
                const primaryId = ids[0];
                const characterKey = this.getCharacterKey(name);
                if (idBasedCostumes[primaryId]) {
                    nameBased[characterKey] = [...idBasedCostumes[primaryId]];
                }
            }
        });
        return nameBased;
    }
};

// 暴露到全局作用域
window.costumeManager = costumeManager;