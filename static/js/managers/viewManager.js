// 处理“页面上和文本输入相关”的小功能（例如格式化输入文本）
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";

export const viewManager = {
  // 初始化：绑定“格式化文本”按钮
  init() {
    const formatBtn = document.getElementById("formatTextBtn");
    if (formatBtn) {
      formatBtn.addEventListener("click", this.formatText.bind(this));
    }
  },

  // 把输入框里的文本整理成“段落间空一行”的格式
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

    if (state.get("projectFile")) {
      state.set("projectFile", null);
    }
    ui.showStatus("文本已成功格式化！", "success");
  },
};
