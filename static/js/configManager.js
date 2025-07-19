// configManager.js - 配置管理相关功能

import { state } from './constants.js';
import { ui } from './uiUtils.js';
import { quoteManager } from './quoteManager.js';

export const configManager = {
    // 加载配置
    async loadConfig() {
        try {
            const response = await axios.get('/api/config');
            state.currentConfig = response.data.character_mapping;
            state.quotesConfig = response.data.quotes_config;
            quoteManager.renderQuoteOptions();
        } catch (error) {
            console.error('加载配置失败:', error);
            ui.showStatus('无法加载应用配置', 'error');
        }
    },

    // 打开配置管理模态框
    openConfigModal() {
        this.renderConfigList();
        ui.openModal('configModal');
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

    // 保存配置
    async saveConfig() {
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

        try {
            await axios.post('/api/config', {
                character_mapping: newConfig
            });
            
            state.currentConfig = newConfig;
            ui.showStatus('配置保存成功！', 'success');
            ui.closeModal('configModal');
        } catch (error) {
            ui.showStatus(`配置保存失败: ${error.response?.data?.error || error.message}`, 'error');
        }
    }
};