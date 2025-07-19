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

    // 设置按钮加载状态
    setButtonLoading(buttonId, isLoading, loadingText = '处理中...') {
        const button = document.getElementById(buttonId);
        if (!button) return;

        if (buttonId === 'convertBtn') {
            const icon = document.getElementById('convertIcon');
            const text = document.getElementById('convertText');
            
            if (isLoading) {
                button.disabled = true;
                icon.innerHTML = '<div class="loading"></div>';
                text.textContent = loadingText;
            } else {
                button.disabled = false;
                icon.textContent = '🔄';
                text.textContent = '开始转换';
            }
        } else {
            button.disabled = isLoading;
            if (isLoading) {
                button.innerHTML = `<div class="loading"></div> ${loadingText}`;
            }
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
                ui.closeModal(modal.id);
            }
        });
    });

    window.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                ui.closeModal(modal.id);
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