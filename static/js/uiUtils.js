// UI相关的工具
import { state } from "./stateManager.js";
import { costumeManager } from "./costumeManager.js";
import { positionManager } from "./positionManager.js";

let statusTimer = null;
const GROUPING_STORAGE_KEY = "bestdori_card_grouping_enabled";

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

export function initPerformanceSettingsPersistence() {
  const checkbox = document.getElementById("groupCardsCheckbox");
  if (!checkbox) return;
  try {
    const savedState = localStorage.getItem(GROUPING_STORAGE_KEY);
    checkbox.checked = savedState === "true";
  } catch (error) {
    console.error("加载卡片分组设置失败:", error);
    checkbox.checked = false;
  }
  checkbox.addEventListener("change", (e) => {
    try {
      localStorage.setItem(GROUPING_STORAGE_KEY, e.target.checked);
    } catch (error) {
      console.error("保存卡片分组设置失败:", error);
      if (ui && ui.showStatus) {
        ui.showStatus("无法保存设置，可能是浏览器存储空间已满。", "error");
      }
    }
  });
}

export function renderGroupedView({
  container,
  actions,
  activeGroupIndex,
  onGroupClick,
  renderItemFn,
  groupSize = 50,
}) {
  container.innerHTML = "";
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
      groupHeader.style.background = "#ebf8ff";
      groupHeader.style.borderColor = "#90cdf4";

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
