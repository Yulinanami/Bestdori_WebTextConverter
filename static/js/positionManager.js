// positionManager.js - Live2D 位置管理功能

import { state } from './constants.js';
import { ui } from './uiUtils.js';

export const positionManager = {
    // 可用的位置选项
    positions: ['leftInside', 'center', 'rightInside'],
    positionNames: {
        'leftInside': '左侧',
        'center': '中间',
        'rightInside': '右侧'
    },
    
    // 默认配置
    autoPositionMode: true,
    manualPositions: {}, // 手动配置的角色位置和偏移
    positionCounter: 0,  // 用于自动分配的计数器
    
    // 初始化
    init() {
        // 加载保存的配置
        this.loadPositionConfig();
        
        // 绑定事件
        const autoCheckbox = document.getElementById('autoPositionCheckbox');
        if (autoCheckbox) {
            autoCheckbox.addEventListener('change', (e) => {
                this.autoPositionMode = e.target.checked;
                this.toggleManualConfig();
            });
        }
        
        const saveBtn = document.getElementById('savePositionsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.savePositions());
        }
        
        // 绑定重置按钮事件
        const resetBtn = document.getElementById('resetPositionsBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetPositions());
        }
    },
    
    // 加载配置
    loadPositionConfig() {
        const saved = localStorage.getItem('bestdori_position_config');
        if (saved) {
            try {
                const config = JSON.parse(saved);
                this.autoPositionMode = config.autoPositionMode !== false;
                this.manualPositions = config.manualPositions || {};
                
                // 确保旧配置的兼容性
                this.ensurePositionFormat();
            } catch (e) {
                console.error('加载位置配置失败:', e);
            }
        }
    },
    
    // 确保位置配置格式正确（兼容旧版本）
    ensurePositionFormat() {
        const updatedPositions = {};
        for (const [name, value] of Object.entries(this.manualPositions)) {
            if (typeof value === 'string') {
                // 旧格式：只有位置字符串
                updatedPositions[name] = {
                    position: value,
                    offset: 0
                };
            } else {
                // 新格式：对象包含位置和偏移
                updatedPositions[name] = {
                    position: value.position || 'center',
                    offset: value.offset || 0
                };
            }
        }
        this.manualPositions = updatedPositions;
    },
    
    // 保存配置
    savePositionConfig() {
        const config = {
            autoPositionMode: this.autoPositionMode,
            manualPositions: this.manualPositions
        };
        localStorage.setItem('bestdori_position_config', JSON.stringify(config));
    },
    
    // 获取头像ID（处理 Mujica 特殊映射）
    getAvatarId(characterId) {
        const avatarMapping = {
            229: 6,   // 纯田真奈
            337: 1,   // 三角初华
            338: 2,   // 若叶睦
            339: 3,   // 八幡海铃
            340: 4,   // 祐天寺若麦
            341: 5    // 丰川祥子
        };
        
        return avatarMapping[characterId] || characterId;
    },
    
    // 打开位置配置模态框
    openPositionModal() {
        // 更新自动模式复选框
        const autoCheckbox = document.getElementById('autoPositionCheckbox');
        if (autoCheckbox) {
            autoCheckbox.checked = this.autoPositionMode;
        }
        
        // 渲染手动配置列表
        this.renderPositionList();
        this.toggleManualConfig();
        
        ui.openModal('positionModal');
    },
    
    // 关闭模态框
    closePositionModal() {
        ui.closeModal('positionModal');
    },
    
    // 切换手动配置显示
    toggleManualConfig() {
        const manualConfig = document.getElementById('manualPositionConfig');
        if (manualConfig) {
            manualConfig.style.display = this.autoPositionMode ? 'none' : 'block';
        }
    },
    
    // 渲染位置列表
    renderPositionList() {
        const positionList = document.getElementById('positionList');
        if (!positionList) return;
        
        positionList.innerHTML = '';
        
        // 获取所有配置的角色
        const characters = Object.entries(state.currentConfig).sort(([, idsA], [, idsB]) => {
            const idA = idsA && idsA.length > 0 ? idsA[0] : Infinity;
            const idB = idsB && idsB.length > 0 ? idsB[0] : Infinity;
            return idA - idB;
        });
        
        characters.forEach(([name, ids]) => {
            if (!ids || ids.length === 0) return;
            
            const primaryId = ids[0];
            const avatarId = this.getAvatarId(primaryId);
            const avatarPath = avatarId > 0 ? `/static/images/avatars/${avatarId}.png` : '';
            
            // 获取当前配置
            const currentConfig = this.manualPositions[name] || { position: 'center', offset: 0 };
            const currentPosition = currentConfig.position || 'center';
            const currentOffset = currentConfig.offset || 0;
            
            const item = document.createElement('div');
            item.className = 'position-config-item';
            item.innerHTML = `
                <div class="position-character-info">
                    <div class="config-avatar-wrapper">
                        <div class="config-avatar" data-id="${primaryId}">
                            ${avatarId > 0 ? 
                                `<img src="${avatarPath}" alt="${name}" class="config-avatar-img" onerror="this.style.display='none'; this.parentElement.innerHTML='${name.charAt(0)}'; this.parentElement.classList.add('fallback');">` 
                                : name.charAt(0)
                            }
                        </div>
                    </div>
                    <span class="position-character-name">${name} (ID: ${primaryId})</span>
                </div>
                <div class="position-controls">
                    <select class="form-input position-select" data-character="${name}">
                        ${this.positions.map(pos => 
                            `<option value="${pos}" ${pos === currentPosition ? 'selected' : ''}>
                                ${this.positionNames[pos]}
                            </option>`
                        ).join('')}
                    </select>
                    <div class="position-offset-group">
                        <label class="position-offset-label" for="offset-${name}">偏移:</label>
                        <input type="number" 
                            id="offset-${name}"
                            class="form-input position-offset-input" 
                            data-character="${name}"
                            value="${currentOffset}"
                            step="10"
                            placeholder="0"
                            title="设置水平偏移量，正值向右，负值向左">
                        <span class="position-offset-hint">px</span>
                    </div>
                </div>
            `;
            
            // 添加事件监听
            const select = item.querySelector('.position-select');
            select.addEventListener('change', (e) => {
                const charName = e.target.dataset.character;
                if (!this.manualPositions[charName]) {
                    this.manualPositions[charName] = { position: 'center', offset: 0 };
                }
                this.manualPositions[charName].position = e.target.value;
            });
            
            // 添加偏移值输入事件
            const offsetInput = item.querySelector('.position-offset-input');
            offsetInput.addEventListener('input', (e) => {
                const charName = e.target.dataset.character;
                const offset = parseInt(e.target.value) || 0;
                
                if (!this.manualPositions[charName]) {
                    this.manualPositions[charName] = { position: 'center', offset: 0 };
                }
                this.manualPositions[charName].offset = offset;
            });
            
            positionList.appendChild(item);
        });
    },
    
    // 保存位置配置
    async savePositions() {
        await ui.withButtonLoading('savePositionsBtn', async () => {
            await new Promise(resolve => setTimeout(resolve, 300));
            
            this.savePositionConfig();
            ui.showStatus('位置配置已保存！', 'success');
            this.closePositionModal();
        }, '保存中...');
    },
    
    // 重置为默认位置（全部设为中间，偏移清零）
    async resetPositions() {
        if (confirm('确定要将所有角色的位置恢复为默认（中间）并清除偏移吗？')) {
            await ui.withButtonLoading('resetPositionsBtn', async () => {
                // 重置自动模式为开启
                this.autoPositionMode = true;
                
                // 清空手动配置
                this.manualPositions = {};
                
                // 更新所有选择框为center，偏移为0
                document.querySelectorAll('.position-select').forEach(select => {
                    select.value = 'center';
                });
                
                document.querySelectorAll('.position-offset-input').forEach(input => {
                    input.value = '0';
                });
                
                // 更新自动模式复选框
                const autoCheckbox = document.getElementById('autoPositionCheckbox');
                if (autoCheckbox) {
                    autoCheckbox.checked = true;
                }
                
                // 切换显示
                this.toggleManualConfig();
                
                // 模拟处理时间
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // 保存配置
                this.savePositionConfig();
                
                ui.showStatus('已恢复默认位置配置！', 'success');
            }, '重置中...');
        }
    },
    
    // 获取角色的位置和偏移
    getCharacterPositionConfig(characterName, appearanceOrder) {
        if (this.autoPositionMode) {
            // 自动分配模式：按出场顺序循环分配，没有偏移
            return {
                position: this.positions[appearanceOrder % this.positions.length],
                offset: 0
            };
        } else {
            // 手动模式：使用配置的位置和偏移，默认为中间、偏移0
            const config = this.manualPositions[characterName] || { position: 'center', offset: 0 };
            return {
                position: config.position || 'center',
                offset: config.offset || 0
            };
        }
    },

    // 导入位置配置
    importPositions(positionConfig) {
        if (!positionConfig) return;
        
        // 导入自动模式设置
        if (typeof positionConfig.autoPositionMode === 'boolean') {
            this.autoPositionMode = positionConfig.autoPositionMode;
        }
        
        // 导入手动位置配置
        if (positionConfig.manualPositions) {
            this.manualPositions = positionConfig.manualPositions;
            // 确保格式正确
            this.ensurePositionFormat();
        }
        
        // 保存到本地存储
        this.savePositionConfig();
        
        console.log('位置配置已导入:', {
            autoMode: this.autoPositionMode,
            manualPositions: this.manualPositions
        });
    },
    
    // 重置位置计数器
    resetPositionCounter() {
        this.positionCounter = 0;
    }
};

// 暴露到全局
window.positionManager = positionManager;