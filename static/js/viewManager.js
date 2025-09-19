// static/js/viewManager.js (简化后)

// 视图管理相关功能
import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";

export const viewManager = {
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
    if (state.get('projectFile')) {
        console.log("Formatted text (classic view), resetting project file state.");
        state.set('projectFile', null);
    }

    ui.showStatus("文本已成功格式化！", "success");
  },
};