// uiUtils.js - UI相关的工具函数

export const ui = {
    showProgress(percent) {
        document.getElementById('progressContainer').style.display = 'block';
        document.getElementById('progressFill').style.width = percent + '%';
    },

    hideProgress() {
        document.getElementById('progressContainer').style.display = 'none';
        document.getElementById('progressFill').style.width = '0%';
    },

    showStatus(message, type) {
        const statusElement = document.getElementById('statusMessage');
        if (!statusElement) return;
        statusElement.textContent = message;
        statusElement.className = `status-message status-${type}`;
        statusElement.style.display = 'block';
    },

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    },

    // 改进的统一按钮加载状态管理
    setButtonLoading(buttonId, isLoading, loadingText = '处理中...') {
        const button = document.getElementById(buttonId);
        if (!button) return;

        // 保存原始内容（如果还没保存的话）
        if (isLoading && !button.dataset.originalContent) {
            button.dataset.originalContent = button.innerHTML;
        }

        if (isLoading) {
            button.disabled = true;
            button.classList.add('btn-loading');
            
            // 特殊处理转换按钮（因为它有图标和文字分离的结构）
            if (buttonId === 'convertBtn') {
                const icon = document.getElementById('convertIcon');
                const text = document.getElementById('convertText');
                if (icon && text) {
                    icon.innerHTML = '<div class="loading"></div>';
                    text.textContent = loadingText;
                }
            } else {
                // 通用按钮处理
                const loadingIcon = '<span class="loading"></span>';
                button.innerHTML = `${loadingIcon} <span>${loadingText}</span>`;
            }
        } else {
            button.disabled = false;
            button.classList.remove('btn-loading');
            
            // 恢复原始内容
            if (buttonId === 'convertBtn') {
                const icon = document.getElementById('convertIcon');
                const text = document.getElementById('convertText');
                if (icon && text) {
                    icon.textContent = '🔄';
                    text.textContent = '开始转换';
                }
            } else if (button.dataset.originalContent) {
                button.innerHTML = button.dataset.originalContent;
                delete button.dataset.originalContent;
            }
        }
    },

    // 新增：快速设置按钮加载状态的辅助方法
    async withButtonLoading(buttonId, asyncFn, loadingText = '处理中...') {
        this.setButtonLoading(buttonId, true, loadingText);
        try {
            await asyncFn();
        } finally {
            this.setButtonLoading(buttonId, false);
        }
    },

    // 滚动到元素
    scrollToElement(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    }
};

// 全局模态框关闭功能
export function initGlobalModalListeners() {
    window.addEventListener('click', function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                // 特殊处理服装配置模态框
                if (modal.id === 'costumeModal') {
                    // 恢复原始状态
                    if (window.costumeManager && window.costumeManager.originalCostumes) {
                        window.costumeManager.cancelCostumeChanges();
                        return; // 不使用通用的closeModal
                    }
                }
                ui.closeModal(modal.id);
            }
        });
    });

    window.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (modal.style.display !== 'none') {
                    // 特殊处理服装配置模态框
                    if (modal.id === 'costumeModal') {
                        if (window.costumeManager && window.costumeManager.originalCostumes) {
                            window.costumeManager.cancelCostumeChanges();
                            return;
                        }
                    }
                    ui.closeModal(modal.id);
                }
            });
        }
    });
}

// 暴露 removeConfigItem 到全局作用域（因为HTML中使用了onclick）
window.removeConfigItem = function(button) {
    button.parentElement.remove();
};

// 暴露 ui 到全局作用域（因为HTML中使用了onclick）
window.ui = ui;