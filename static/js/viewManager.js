// 视图管理相关功能
import { state } from "./stateManager.js";
import { converter } from "./converter.js";
import { ui } from "./uiUtils.js";

export const viewManager = {
  // 视图切换
  switchView(e) {
    const button = e.target.closest(".view-btn");
    if (!button) {
      console.error("无法找到 .view-btn 按钮。");
      return;
    }
    const targetView = button.dataset.view;
    const currentActiveButton = document.querySelector(".view-btn.active");
    if (currentActiveButton) {
      currentActiveButton.classList.remove("active");
    }
    button.classList.add("active");
    document
      .querySelectorAll(".view-content")
      .forEach((view) => view.classList.remove("active"));
    const targetViewElement = document.getElementById(targetView + "View");
    if (targetViewElement) {
      targetViewElement.classList.add("active");
    } else {
      console.error(
        `无法找到视图元素: #${targetView}View。可能是由于页面翻译工具修改了DOM。`
      );
    }
    if (targetView === "split") {
      this.syncTextAreas();
      this.syncConfigToSplit();
      this.syncLive2DToSplit();
      if (state.get("autoPreviewEnabled")) {
        converter.updateSplitPreview();
      }
    }
  },

  // 同步Live2D设置到分屏视图
  syncLive2DToSplit() {
    const splitCheckbox = document.getElementById("splitEnableLive2DCheckbox");
    if (splitCheckbox) {
      splitCheckbox.checked = state.get("enableLive2D");
    }
  },

  // 预览模式切换
  switchPreviewMode(e) {
    const button = e.target.closest(".preview-mode-btn");
    if (!button) {
      console.error("无法找到 .preview-mode-btn 按钮。");
      return;
    }
    const mode = button.dataset.mode;
    const currentActiveButton = document.querySelector(
      ".preview-mode-btn.active"
    );
    if (currentActiveButton) {
      currentActiveButton.classList.remove("active");
    }
    button.classList.add("active");
    if (mode === "json") {
      document.getElementById("splitPreviewJson").style.display = "block";
      document.getElementById("splitPreviewDialogue").style.display = "none";
    } else {
      document.getElementById("splitPreviewJson").style.display = "none";
      document.getElementById("splitPreviewDialogue").style.display = "block";
    }
  },

  // 同步两个文本框的内容
  syncTextAreas() {
    const classicText = document.getElementById("inputText").value;
    const splitText = document.getElementById("splitInputText").value;
    if (document.getElementById("classicView").classList.contains("active")) {
      document.getElementById("splitInputText").value = classicText;
    } else {
      document.getElementById("inputText").value = splitText;
    }
  },

  // 同步配置到分屏视图
  syncConfigToSplit() {
    const narratorName = document.getElementById("narratorName").value;
    document.getElementById("splitNarratorName").value = narratorName;
  },

  // 初始化分隔条拖动功能
  initializeSplitResizer() {
    const resizer = document.getElementById("splitResizer");
    const leftPanel = document.querySelector(".left-panel");
    const rightPanel = document.querySelector(".right-panel");
    const container = document.querySelector(".split-container");
    if (!resizer) return;
    let isResizing = false;
    let startX = 0;
    let startLeftWidth = 0;
    resizer.addEventListener("mousedown", (e) => {
      isResizing = true;
      startX = e.clientX;
      startLeftWidth = leftPanel.offsetWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isResizing) return;
      const dx = e.clientX - startX;
      const containerWidth = container.offsetWidth;
      const newLeftWidth = startLeftWidth + dx;
      const minWidth = 300;
      const maxWidth = containerWidth - minWidth - resizer.offsetWidth;
      if (newLeftWidth >= minWidth && newLeftWidth <= maxWidth) {
        const leftPercent = (newLeftWidth / containerWidth) * 100;
        const rightPercent =
          100 - leftPercent - (resizer.offsetWidth / containerWidth) * 100;
        leftPanel.style.flex = `0 0 ${leftPercent}%`;
        rightPanel.style.flex = `0 0 ${rightPercent}%`;
      }
    });
    document.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    });
  },

  // 格式化分屏文本
  formatTextSplit() {
    const textarea = document.getElementById("splitInputText");
    const originalText = textarea.value;
    if (!originalText.trim()) {
      ui.showStatus("文本内容为空，无需格式化。", "info");
      return;
    }
    const lines = originalText.split(/\r?\n/);
    const contentLines = lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const formattedText = contentLines.join("\n\n");
    textarea.value = formattedText;
    ui.showStatus("文本已成功格式化！", "success");
    if (state.get("autoPreviewEnabled")) {
      converter.updateSplitPreview();
    }
  },

  // 格式化经典视图文本
  formatText() {
    const textarea = document.getElementById("inputText");
    const originalText = textarea.value;
    if (!originalText.trim()) {
      ui.showStatus("文本内容为空，无需格式化。", "info");
      return;
    }
    const lines = originalText.split(/\r?\n/);
    const contentLines = lines
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const formattedText = contentLines.join("\n\n");
    textarea.value = formattedText;
    ui.showStatus("文本已成功格式化！", "success");
  },

  // 防抖预览更新
  debouncePreview() {
    if (!state.get("autoPreviewEnabled")) return;
    clearTimeout(state.get("previewDebounceTimer"));
    state.set("previewDebounceTimer", setTimeout(() => {
      converter.updateSplitPreview();
    }, 500));
  },
};
