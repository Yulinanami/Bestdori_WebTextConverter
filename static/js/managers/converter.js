// 点击转换：把文本/项目数据交给后端转换，并把结果显示出来
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { quoteManager } from "@managers/quoteManager.js";
import { apiService } from "@services/ApiService.js";
import { createProjectFileFromText } from "@utils/ConverterCore.js";

export const converter = {
  // 初始化：绑定“转换”按钮
  init() {
    const convertButton = document.getElementById("convertBtn");
    if (convertButton) {
      convertButton.addEventListener("click", this.convertText.bind(this));
    }

    const copyButton = document.getElementById("copyBtn");
    if (copyButton) {
      copyButton.addEventListener("click", this.copyResult.bind(this));
    }
  },

  // 复制当前转换结果 JSON
  async copyResult() {
    const currentResult = state.get("currentResult");
    if (!currentResult) {
      ui.showStatus("没有可复制的结果！", "error");
      return;
    }

    const copied = await ui.copyToClipboard(currentResult);
    if (copied) {
      ui.showStatus("转换结果已复制到剪贴板！", "success");
      return;
    }
    ui.showStatus("复制失败，请手动选择复制。", "error");
  },

  // 收集输入内容与选项，并开始转换（文本模式或“已保存的项目模式”）
  async convertText() {
    let projectFileToConvert;

    if (state.get("projectFile")) {
      projectFileToConvert = state.get("projectFile");
    } else {
      const inputText = document.getElementById("inputText").value.trim();
      if (!inputText) {
        ui.showStatus("请输入要转换的文本！", "error");
        return;
      }
      projectFileToConvert = createProjectFileFromText(
        inputText,
        state.get("currentConfig"),
      );
    }

    const selectedQuotes = quoteManager.getSelectedQuotes();
    // 如果用户没有输入旁白名称，发送空字符串让后端使用配置默认值
    const narratorInput = document.getElementById("narratorName").value;
    const narratorName = narratorInput.trim() ? narratorInput : "";
    const appendSpaces = parseInt(document.getElementById("appendSpaces").value) || 0;
    const appendSpacesBeforeNewline =
      parseInt(document.getElementById("appendSpacesBeforeNewline").value) || 0;

    this.convertFromProjectFile(
      projectFileToConvert,
      selectedQuotes,
      narratorName,
      appendSpaces,
      appendSpacesBeforeNewline,
    );
  },

  // 把项目文件发给后端转换，并把 JSON 结果渲染到页面上
  async convertFromProjectFile(
    projectFile,
    selectedQuotes = [],
    narratorName,
    appendSpaces = 0,
    appendSpacesBeforeNewline = 0,
  ) {
    const buttonId = "convertBtn";
    try {
      ui.setButtonLoading(buttonId, true, "转换中...");
      ui.showStatus("正在发送项目数据...", "info");

      const convertResponse = await apiService.convertText(
        projectFile,
        selectedQuotes,
        narratorName,
        appendSpaces,
        appendSpacesBeforeNewline,
      );
      const result = convertResponse.result;

      state.set("currentResult", result);
      document.getElementById("resultContent").textContent = result;
      Prism.highlightElement(document.getElementById("resultContent"));
      const resultSection = document.getElementById("resultSection");
      resultSection.classList.remove("hidden");
      ui.showStatus("转换完成！", "success");
      resultSection.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      ui.showStatus(error.message, "error");
    } finally {
      ui.setButtonLoading(buttonId, false);
    }
  },
};
