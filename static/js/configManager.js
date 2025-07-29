// configManager.js - 配置管理相关功能

import { state } from './constants.js';
import { ui } from './uiUtils.js';
import { quoteManager } from './quoteManager.js';
import { costumeManager } from './costumeManager.js';  // 新增导入

export const configManager = {
    // 默认配置
    defaultConfig: null,

    getAvatarId(characterId) {
        const mujicaAvatarMapping = {
            337: 1,  // 三角初华
            338: 2,  // 若叶睦
            339: 3,  // 八幡海铃
            340: 4,  // 祐天寺若麦
            341: 5   // 丰川祥子
        };
        
        return mujicaAvatarMapping[characterId] || characterId;
    },
    
    // 加载配置
    async loadConfig() {
        try {
            // 先从服务器获取默认配置
            const response = await axios.get('/api/config');
            this.defaultConfig = response.data.character_mapping;
            state.quotesConfig = response.data.quotes_config;
            
            // 尝试从 LocalStorage 加载用户自定义配置
            const savedConfig = this.loadLocalConfig();
            if (savedConfig) {
                state.currentConfig = savedConfig;
                console.log('已加载本地保存的配置');
            } else {
                state.currentConfig = { ...this.defaultConfig };
                console.log('使用默认配置');
            }
            
            quoteManager.renderQuoteOptions();
        } catch (error) {
            console.error('加载配置失败:', error);
            ui.showStatus('无法加载应用配置', 'error');
        }
    },

    // 从 LocalStorage 加载配置
    loadLocalConfig() {
        try {
            const saved = localStorage.getItem('bestdori_character_mapping');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('加载本地配置失败:', error);
        }
        return null;
    },

    // 保存配置到 LocalStorage
    saveLocalConfig(config) {
        try {
            localStorage.setItem('bestdori_character_mapping', JSON.stringify(config));
            return true;
        } catch (error) {
            console.error('保存本地配置失败:', error);
            return false;
        }
    },

    // 打开配置管理模态框
    async openConfigModal() {
        await ui.withButtonLoading('configBtn', async () => {
            // 模拟加载时间
            await new Promise(resolve => setTimeout(resolve, 100));
            this.renderConfigList();
            ui.openModal('configModal');
        }, '加载配置...');
    },
    
    // 重置为默认配置（修改版：保留服装配置）
    async resetConfig() {
        if (confirm('确定要恢复默认角色配置吗？这将清除您的自定义角色映射和引号设置，但会保留服装配置。')) {
            await ui.withButtonLoading('resetConfigBtn', async () => {
                // 保存当前的服装配置
                const currentCostumes = { ...state.currentCostumes };
                const currentAvailableCostumes = costumeManager ? { ...costumeManager.availableCostumes } : {};
                
                // 清除角色映射
                localStorage.removeItem('bestdori_character_mapping');
                state.currentConfig = { ...this.defaultConfig };
                
                // 清除自定义引号
                localStorage.removeItem('bestdori_custom_quotes');
                state.customQuotes = [];
                
                // 不清除服装配置，而是更新它
                if (costumeManager) {
                    // 为新的角色映射更新服装配置
                    await this.updateCostumesAfterConfigReset(currentCostumes, currentAvailableCostumes);
                }
                
                // 模拟处理时间
                await new Promise(resolve => setTimeout(resolve, 300));
                
                this.renderConfigList();
                quoteManager.renderQuoteOptions();
                
                ui.showStatus('已恢复默认角色配置（服装配置已保留）', 'success');
            }, '重置中...');
        }
    },

    async updateCostumesAfterConfigReset(previousCostumes, previousAvailableCostumes) {
        // 创建新的服装配置对象
        const newCostumes = {};
        const newAvailableCostumes = {};
        
        // 遍历新的角色配置
        Object.entries(state.currentConfig).forEach(([name, ids]) => {
            if (ids && ids.length > 0) {
                const characterKey = costumeManager.getCharacterKey(name);
                const primaryId = ids[0];
                
                // 如果之前有这个角色的服装配置，保留它
                if (previousCostumes[characterKey] !== undefined) {
                    newCostumes[characterKey] = previousCostumes[characterKey];
                    newAvailableCostumes[characterKey] = previousAvailableCostumes[characterKey] || [];
                } else {
                    // 新角色，使用默认服装
                    const defaultCostume = costumeManager.defaultCostumes[primaryId] || '';
                    newCostumes[characterKey] = defaultCostume;
                    
                    // 从默认可用服装列表复制
                    if (costumeManager.defaultAvailableCostumes[primaryId]) {
                        newAvailableCostumes[characterKey] = [...costumeManager.defaultAvailableCostumes[primaryId]];
                    } else {
                        newAvailableCostumes[characterKey] = [];
                    }
                }
            }
        });

        // 更新状态
        state.currentCostumes = newCostumes;
        costumeManager.availableCostumes = newAvailableCostumes;
        
        // 保存到本地存储
        costumeManager.saveLocalCostumes(newCostumes);
        costumeManager.saveLocalAvailableCostumes();
    },

    // 渲染配置列表
    renderConfigList() {
        const configList = document.getElementById('configList');
        configList.innerHTML = '';

        const sortedConfig = Object.entries(state.currentConfig).sort(([, idsA], [, idsB]) => {
            const idA = idsA && idsA.length > 0 ? idsA[0] : Infinity;
            const idB = idsB && idsB.length > 0 ? idsB[0] : Infinity;
            return idA - idB;
        });

        sortedConfig.forEach(([name, ids]) => {
            const configItem = document.createElement('div');
            configItem.className = 'config-item';
            
            const primaryId = ids && ids.length > 0 ? ids[0] : 0;
            
            // 获取头像显示ID
            const avatarId = this.getAvatarId(primaryId);
            const avatarPath = avatarId > 0 ? `/static/images/avatars/${avatarId}.png` : '';
            
            configItem.innerHTML = `
                <div class="config-avatar-wrapper">
                    <div class="config-avatar" data-id="${primaryId}">
                        ${avatarId > 0 ? 
                            `<img src="${avatarPath}" alt="${name}" class="config-avatar-img" onerror="this.style.display='none'; this.parentElement.innerHTML='${name.charAt(0)}'; this.parentElement.classList.add('fallback');">` 
                            : name.charAt(0)
                        }
                    </div>
                </div>
                <input type="text" placeholder="角色名称" value="${name}" class="form-input config-name">
                <input type="text" placeholder="ID列表(逗号分隔)" value="${ids.join(',')}" class="form-input config-ids">
                <button class="remove-btn" onclick="removeConfigItem(this)">删除</button>
            `;
            
            // 添加ID输入变化时更新头像的事件
            const idsInput = configItem.querySelector('.config-ids');
            const avatarWrapper = configItem.querySelector('.config-avatar-wrapper');
            
            idsInput.addEventListener('input', (e) => {
                const newIds = e.target.value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                const newPrimaryId = newIds.length > 0 ? newIds[0] : 0;
                
                // 更新头像显示
                this.updateConfigAvatar(avatarWrapper, newPrimaryId, name);
            });
            
            configList.appendChild(configItem);
        });
    },

    // 新增方法：更新配置项头像
    updateConfigAvatar(avatarWrapper, id, name) {
        const avatar = avatarWrapper.querySelector('.config-avatar');
        avatar.dataset.id = id;
        
        const avatarId = this.getAvatarId(id); // 使用头像映射
        
        if (avatarId > 0) {
            avatar.className = 'config-avatar';
            avatar.innerHTML = `<img src="/static/images/avatars/${avatarId}.png" alt="${name}" class="config-avatar-img">`;
            
            const img = avatar.querySelector('img');
            img.onerror = () => {
                avatar.innerHTML = name.charAt(0);
                avatar.classList.add('fallback');
            };
        } else {
            avatar.className = 'config-avatar fallback';
            avatar.innerHTML = name.charAt(0);
        }
    },

    // 添加配置项
    addConfigItem() {
        const configList = document.getElementById('configList');
        const configItem = document.createElement('div');
        configItem.className = 'config-item';
        configItem.innerHTML = `
            <div class="config-avatar-wrapper">
                <div class="config-avatar fallback" data-id="0">?</div>
            </div>
            <input type="text" placeholder="角色名称" class="form-input config-name">
            <input type="text" placeholder="ID列表(逗号分隔)" class="form-input config-ids">
            <button class="remove-btn" onclick="removeConfigItem(this)">删除</button>
        `;
        
        // 为新添加的项也绑定事件
        const idsInput = configItem.querySelector('.config-ids');
        const nameInput = configItem.querySelector('.config-name');
        const avatarWrapper = configItem.querySelector('.config-avatar-wrapper');
        
        idsInput.addEventListener('input', (e) => {
            const newIds = e.target.value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            const newPrimaryId = newIds.length > 0 ? newIds[0] : 0;
            const name = nameInput.value || '?';
            
            this.updateConfigAvatar(avatarWrapper, newPrimaryId, name);
        });
        
        nameInput.addEventListener('input', (e) => {
            const avatar = avatarWrapper.querySelector('.config-avatar');
            if (avatar.classList.contains('fallback')) {
                avatar.innerHTML = e.target.value.charAt(0) || '?';
            }
        });
        
        configList.prepend(configItem);
    },

    // 保存配置（只保存到本地）
    async saveConfig() {
        await ui.withButtonLoading('saveConfigBtn', async () => {
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

            // 模拟保存时间
            await new Promise(resolve => setTimeout(resolve, 500));

            // 保存到 LocalStorage
            if (this.saveLocalConfig(newConfig)) {
                state.currentConfig = newConfig;
                ui.showStatus('配置已保存到本地！', 'success');
                ui.closeModal('configModal');
            } else {
                ui.showStatus('配置保存失败，可能是存储空间不足', 'error');
            }
        }, '保存中...');
    },

    // 导出配置（包含内置角色信息）
    async exportConfig() {
        await ui.withButtonLoading('exportConfigBtn', async () => {
            const fullConfig = {
                character_mapping: state.currentConfig,
                custom_quotes: state.customQuotes,
                costume_mapping: state.currentCostumes,
                available_costumes: costumeManager ? costumeManager.availableCostumes : {},
                built_in_characters: costumeManager ? Array.from(costumeManager.builtInCharacters) : [], // 新增
                enable_live2d: state.enableLive2D,
                export_date: new Date().toISOString(),
                version: '1.3' // 更新版本号
            };
            
            const dataStr = JSON.stringify(fullConfig, null, 2);
            const blob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `bestdori_config_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            ui.showStatus('配置已导出（包含自定义角色信息）', 'success');
        }, '导出中...');
    },

    // 导入配置（包含引号配置和服装配置）
    importConfig(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);
                
                // 处理不同版本的配置文件
                if (config.character_mapping) {
                    // 新版本格式
                    state.currentConfig = config.character_mapping;
                    this.saveLocalConfig(config.character_mapping);
                    
                    // 导入自定义引号
                    if (config.custom_quotes) {
                        state.customQuotes = config.custom_quotes;
                        quoteManager.saveCustomQuotes();
                    }
                    
                    // 导入服装配置（包括可用服装列表）
                    if (config.costume_mapping || config.available_costumes || typeof config.enable_live2d === 'boolean') {
                        // 传递完整的配置对象
                        costumeManager.importCostumes(config);
                    }
                } else {
                    // 旧版本格式（直接是角色映射）
                    state.currentConfig = config;
                    this.saveLocalConfig(config);
                }
                
                this.renderConfigList();
                quoteManager.renderQuoteOptions();
                
                ui.showStatus('配置导入成功', 'success');
            } catch (error) {
                ui.showStatus('配置文件格式错误', 'error');
            }
        };
        reader.readAsText(file);
        }
    };