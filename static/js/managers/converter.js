// 文本转换管理
import { state } from "./stateManager.js";
import { ui } from "../utils/uiUtils.js";
import { quoteManager } from "./quoteManager.js";
import { apiService } from "../services/ApiService.js";
import { createProjectFileFromText } from "../utils/ConverterCore.js";

export const converter = {
  init() {
    const convertBtn = document.getElementById("convertBtn");
    if (convertBtn) {
      convertBtn.addEventListener("click", this.convertText.bind(this));
    }
  },

  // 转换文本为 Bestdori JSON 格式
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
        state.get("currentConfig")
      );
    }

    const selectedQuotes = quoteManager.getSelectedQuotes();
    const narratorName = document.getElementById("narratorName").value || " ";
    const appendSpaces =
      parseInt(document.getElementById("appendSpaces").value, 10) || 0;
    const appendSpacesBeforeNewline =
      parseInt(
        document.getElementById("appendSpacesBeforeNewline").value,
        10
      ) || 0;

    this.convertFromProjectFile(
      projectFileToConvert,
      selectedQuotes,
      narratorName,
      appendSpaces,
      appendSpacesBeforeNewline
    );
  },

  async convertFromProjectFile(
    projectFile,
    selectedQuotes = [],
    narratorName,
    appendSpaces = 0,
    appendSpacesBeforeNewline = 0
  ) {
    const buttonId = "convertBtn";
    try {
      ui.setButtonLoading(buttonId, true, "转换中...");
      ui.showProgress(10);
      ui.showStatus("正在发送项目数据...", "info");

      const data = await apiService.convertText(
        projectFile,
        selectedQuotes,
        narratorName,
        appendSpaces,
        appendSpacesBeforeNewline
      );
      const result = data.result;

      ui.showProgress(100);
      state.set("currentResult", result);
      document.getElementById("resultContent").textContent = result;
      Prism.highlightElement(document.getElementById("resultContent"));
      const resultSection = document.getElementById("resultSection");
      resultSection.style.display = "block";
      ui.showStatus("转换完成！", "success");
      resultSection.scrollIntoView({ behavior: "smooth" });

      setTimeout(() => ui.hideProgress(), 1000);
    } catch (error) {
      ui.showStatus(error.message, "error");
      ui.hideProgress();
    } finally {
      ui.setButtonLoading(buttonId, false);
    }
  },
};
