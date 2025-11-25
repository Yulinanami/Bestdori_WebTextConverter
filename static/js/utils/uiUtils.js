// UI相关的工具
import { state } from "@managers/stateManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { modalService } from "@services/ModalService.js";

let statusTimer = null;
export const GROUPING_STORAGE_KEY = STORAGE_KEYS.CARD_GROUPING;

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
    modalService.open(modalId);
  },

  closeModal(modalId) {
    modalService.close(modalId);
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
          icon.textContent = "";
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
    if (state.get("currentResult")) {
      const copied = await this.copyToClipboard(state.get("currentResult"));
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

export function initPerformanceSettingsPersistence() {
  const checkbox = document.getElementById("groupCardsCheckbox");
  if (!checkbox) return;

  // 加载保存的设置
  const savedState = storageService.get(GROUPING_STORAGE_KEY, true);
  checkbox.checked = savedState === true || savedState === "true";

  // 监听变化
  checkbox.addEventListener("change", (e) => {
    if (!storageService.set(GROUPING_STORAGE_KEY, e.target.checked)) {
      console.error("保存卡片分组设置失败");
      if (ui && ui.showStatus) {
        ui.showStatus("无法保存设置，可能是浏览器存储空间已满。", "error");
      }
    }
  });
}
