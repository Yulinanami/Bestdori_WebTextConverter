// 输入框相关的小功能
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";

export const viewManager = {
  // 初始化页面按钮
  init() {
    document
      .getElementById("formatTextBtn")
      ?.addEventListener("click", this.formatText.bind(this));
  },

  // 整理输入框里的文本
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

    if (state.projectFile) {
      state.projectFile = null;
    }
    ui.showStatus("文本已成功格式化！", "success");
  },
};
