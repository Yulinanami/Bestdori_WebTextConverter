// UI相关的工具
import { state } from "./stateManager.js";
import { costumeManager } from "./costumeManager.js";
import { positionManager } from "./positionManager.js";
import { storageService, STORAGE_KEYS } from "./services/StorageService.js";
import { modalService } from "./services/ModalService.js";
import { DOMUtils } from "./utils/DOMUtils.js";

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
  const savedState = storageService.get(GROUPING_STORAGE_KEY, false);
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

/**
 * 渲染分组折叠视图
 * 将大量动作分组显示,每组50条(可配置)
 * 点击组头展开/折叠该组,同时只能展开一组
 * 性能优化:只渲染展开组的DOM元素,其他组只显示头部
 * @param {HTMLElement} container - 容器元素
 * @param {Array} actions - 动作数组
 * @param {number|null} activeGroupIndex - 当前展开的组索引
 * @param {Function} onGroupClick - 组头点击回调
 * @param {Function} renderItemFn - 单个动作渲染函数
 * @param {number} groupSize - 每组大小,默认50
 */
export function renderGroupedView({
  container,
  actions,
  activeGroupIndex,
  onGroupClick,
  renderItemFn,
  groupSize = 50,
}) {
  DOMUtils.clearElement(container);
  const totalActions = actions.length;
  const numGroups = Math.ceil(totalActions / groupSize);
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < numGroups; i++) {
    const startNum = i * groupSize + 1;
    const endNum = Math.min((i + 1) * groupSize, totalActions);
    const groupHeader = document.createElement("div");
    groupHeader.className = "timeline-group-header";
    groupHeader.textContent = `▶ 对话 ${startNum} - ${endNum} (${
      endNum - startNum + 1
    }条)`;
    groupHeader.dataset.groupIdx = i;
    groupHeader.style.cursor = "pointer";
    groupHeader.style.padding = "12px 18px";
    groupHeader.style.background = "var(--bg-secondary)";
    groupHeader.style.border = "1px solid var(--border-primary)";
    groupHeader.style.borderRadius = "var(--radius-lg)";
    groupHeader.style.marginBottom = "15px";
    groupHeader.style.fontWeight = "600";
    groupHeader.style.transition = "all 0.2s ease";
    groupHeader.addEventListener("click", () => onGroupClick(i));
    fragment.appendChild(groupHeader);
    if (i === activeGroupIndex) {
      groupHeader.classList.add("active");
      groupHeader.textContent = `▼ 对话 ${startNum} - ${endNum} (${
        endNum - startNum + 1
      }条)`;
      groupHeader.style.background = "var(--group-header-active-bg, #ebf8ff)";
      groupHeader.style.borderColor = "var(--group-header-active-border, #90cdf4)";

      const actionsToRender = actions.slice(startNum - 1, endNum);
      actionsToRender.forEach((action) => {
        const cardElement = renderItemFn(action);
        if (cardElement) {
          fragment.appendChild(cardElement);
        }
      });
    }
  }

  container.appendChild(fragment);
}

export function initializeModalCloseButtons() {
  document
    .querySelectorAll(".modal-close, .btn-modal-close")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const modalId = button.dataset.modalId || button.closest(".modal")?.id;
        if (modalId) {
          modalService.close(modalId);
        }
      });
    });
}
