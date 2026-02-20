// 页面 UI 小工具：进度条、提示条、按钮 loading、复制、跳转等。
import { state } from "@managers/stateManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { modalService } from "@services/ModalService.js";

let statusTimer = null;
const GROUPING_STORAGE_KEY = STORAGE_KEYS.CARD_GROUPING;

export const ui = {
  // 显示顶部进度条，并设置进度百分比
  showProgress(percent) {
    document.getElementById("progressContainer").style.display = "block";
    document.getElementById("progressFill").style.width = `${percent}%`;
  },

  // 隐藏顶部进度条
  hideProgress() {
    document.getElementById("progressContainer").style.display = "none";
    document.getElementById("progressFill").style.width = "0%";
  },

  // 在页面右下角弹出一条提示（success/info/error）
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

  // 打开一个弹窗（modalId 是弹窗的 DOM id）
  openModal(modalId) {
    modalService.open(modalId);
  },

  // 关闭一个弹窗
  closeModal(modalId) {
    modalService.close(modalId);
  },

  // 把按钮切换到“加载中/正常”状态（并可替换按钮文字）
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

  // 用 try/finally 包住异步函数：自动开/关按钮 loading
  async withButtonLoading(buttonId, asyncFn, loadingText = "处理中...") {
    this.setButtonLoading(buttonId, true, loadingText);
    try {
      await asyncFn();
    } finally {
      this.setButtonLoading(buttonId, false);
    }
  },

  // 复制文本到剪贴板（成功返回 true）
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error("复制失败:", err);
      return false;
    }
  },

  // 一键跳转到 Bestdori 发帖页面（会先尝试把 JSON 复制到剪贴板）
  async goToBestdori() {
    if (state.get("currentResult")) {
      const copied = await this.copyToClipboard(state.get("currentResult"));
      if (copied) {
        this.showStatus(
          "JSON 已复制到剪贴板，正在跳转到 Bestdori...",
          "success",
        );
      }
    }
    setTimeout(() => {
      window.open("https://bestdori.com/community/stories/new", "_blank");
    }, 500);
  },
};

// 把“卡片分组”开关状态保存到本地（下次打开仍生效）
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
