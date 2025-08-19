// uiUtils.js - UI相关的工具函数
import { state } from "./constants.js";
import { costumeManager } from "./costumeManager.js"; // <-- 导入
import { positionManager } from "./positionManager.js"; // <-- 导入

let statusTimer = null;

export const ui = {
  showProgress(percent) {
    document.getElementById("progressContainer").style.display = "block";
    document.getElementById("progressFill").style.width = percent + "%";
  },

  hideProgress() {
    document.getElementById("progressContainer").style.display = "none";
    document.getElementById("progressFill").style.width = "0%";
  },

  showStatus(message, type) {
    const statusElement = document.getElementById("statusMessage");
    if (!statusElement) return;
    clearTimeout(statusTimer);
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    statusElement.style.display = "block";
    statusTimer = setTimeout(() => {
      statusElement.style.display = "none";
    }, 4000);
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = "flex";
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = "none";
    }
  },

  setButtonLoading(buttonId, isLoading, loadingText = "处理中...") {
    const button = document.getElementById(buttonId);
    if (!button) return;
    if (isLoading && !button.dataset.originalContent) {
      button.dataset.originalContent = button.innerHTML;
    }
    if (isLoading) {
      button.disabled = true;
      button.classList.add("btn-loading");
      if (buttonId === "convertBtn") {
        const icon = document.getElementById("convertIcon");
        const text = document.getElementById("convertText");
        if (icon && text) {
          icon.innerHTML = '<div class="loading"></div>';
          text.textContent = loadingText;
        }
      } else {
        const loadingIcon = '<span class="loading"></span>';
        button.innerHTML = `${loadingIcon} <span>${loadingText}</span>`;
      }
    } else {
      button.disabled = false;
      button.classList.remove("btn-loading");
      if (buttonId === "convertBtn") {
        const icon = document.getElementById("convertIcon");
        const text = document.getElementById("convertText");
        if (icon && text) {
          icon.textContent = "🔄";
          text.textContent = "开始转换";
        }
      } else if (button.dataset.originalContent) {
        button.innerHTML = button.dataset.originalContent;
        delete button.dataset.originalContent;
      }
    }
  },

  // 快速设置按钮加载状态的辅助方法
  async withButtonLoading(buttonId, asyncFn, loadingText = "处理中...") {
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
      element.scrollIntoView({ behavior: "smooth" });
    }
  },

  // 添加复制到剪贴板的方法
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error("复制失败:", err);
      return false;
    }
  },

  // 添加跳转到 Bestdori 的方法
  async goToBestdori() {
    if (state.currentResult) {
      const copied = await this.copyToClipboard(state.currentResult);
      if (copied) {
        this.showStatus(
          "JSON 已复制到剪贴板，正在跳转到 Bestdori...",
          "success"
        );
      }
    }
    setTimeout(() => {
      window.open("https://bestdori.com/community/stories/new", "_blank");
    }, 500);
  },
};

// 全局模态框关闭功能
export function initGlobalModalListeners() {
  window.addEventListener("click", function (event) {
    const modals = document.querySelectorAll(".modal");
    modals.forEach((modal) => {
      if (event.target === modal) {
        if (modal.id === "costumeModal") {
          costumeManager.cancelCostumeChanges();
          return;
        }
        ui.closeModal(modal.id);
      }
    });
  });
  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      const modals = document.querySelectorAll(".modal");
      modals.forEach((modal) => {
        if (modal.style.display !== "none") {
          if (modal.id === "costumeModal") {
            costumeManager.cancelCostumeChanges();
            return;
          }
          ui.closeModal(modal.id);
        }
      });
    }
  });
}

export function initializeModalCloseButtons() {
  document
    .querySelectorAll(".modal-close, .btn-modal-close")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const modalId = button.dataset.modalId || button.closest(".modal").id;
        if (modalId) {
          if (modalId === "costumeModal") {
            costumeManager.cancelCostumeChanges();
          } else if (modalId === "positionModal") {
            positionManager.closePositionModal();
          } else {
            ui.closeModal(modalId);
          }
        }
      });
    });
}