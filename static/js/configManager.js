// configManager.js - 配置管理相关功能

import { state } from './constants.js';
import { ui } from './uiUtils.js';
import { quoteManager } from './quoteManager.js';

export const configManager = {
    // 默认配置
    defaultConfig: null,
    
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
    
    // 重置为默认配置（同时清除自定义引号）
    async resetConfig() {
        if (confirm('确定要恢复默认配置吗？这将清除您的所有自定义设置，包括自定义引号。')) {
            await ui.withButtonLoading('resetConfigBtn', async () => {
                // 清除角色映射
                localStorage.removeItem('bestdori_character_mapping');
                state.currentConfig = { ...this.defaultConfig };
                
                // 清除自定义引号
                localStorage.removeItem('bestdori_custom_quotes');
                state.customQuotes = [];
                
                // 模拟处理时间
                await new Promise(resolve => setTimeout(resolve, 300));
                
                this.renderConfigList();
                quoteManager.renderQuoteOptions();
                
                ui.showStatus('已恢复默认配置', 'success');
            }, '重置中...');
        }
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
            configItem.innerHTML = `
                <input type="text" placeholder="角色名称" value="${name}" class="form-input config-name">
                <input type="text" placeholder="ID列表(逗号分隔)" value="${ids.join(',')}" class="form-input config-ids">
                <button class="remove-btn" onclick="removeConfigItem(this)">删除</button>
            `;
            configList.appendChild(configItem);
        });
    },

    // 添加配置项
    addConfigItem() {
        const configList = document.getElementById('configList');
        const configItem = document.createElement('div');
        configItem.className = 'config-item';
        configItem.innerHTML = `
            <input type="text" placeholder="角色名称" class="form-input config-name">
            <input type="text" placeholder="ID列表(逗号分隔)" class="form-input config-ids">
            <button class="remove-btn" onclick="removeConfigItem(this)">删除</button>
        `;
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

    // 导出配置（包含引号配置）
    async exportConfig() {
        await ui.withButtonLoading('exportConfigBtn', async () => {
            const fullConfig = {
                character_mapping: state.currentConfig,
                custom_quotes: state.customQuotes,
                export_date: new Date().toISOString(),
                version: '1.0'
            };
            
            const dataStr = JSON.stringify(fullConfig, null, 2);
            const blob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            
            // 模拟处理时间
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `bestdori_config_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            ui.showStatus('配置已导出（包含自定义引号）', 'success');
        }, '导出中...');
    },

    // 导入配置（包含引号配置）
    importConfig(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);
                
                // 兼容旧版本（只有角色映射）
                if (config.character_mapping) {
                    // 新版本格式
                    state.currentConfig = config.character_mapping;
                    this.saveLocalConfig(config.character_mapping);
                    
                    // 导入自定义引号
                    if (config.custom_quotes) {
                        state.customQuotes = config.custom_quotes;
                        quoteManager.saveCustomQuotes();
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