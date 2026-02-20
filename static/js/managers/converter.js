// 点击转换：把文本/项目数据交给后端转换，并把结果显示出来
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { quoteManager } from "@managers/quoteManager.js";
import { apiService } from "@services/ApiService.js";
import { createProjectFileFromText } from "@utils/ConverterCore.js";

export const converter = {
  // 初始化：绑定“转换”按钮
  init() {
    const convertBtn = document.getElementById("convertBtn");
    if (convertBtn) {
      convertBtn.addEventListener("click", this.convertText.bind(this));
    }
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
    const appendSpaces =
      parseInt(document.getElementById("appendSpaces").value, 10) || 0;
    const appendSpacesBeforeNewline =
      parseInt(
        document.getElementById("appendSpacesBeforeNewline").value,
        10,
      ) || 0;

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
      ui.showProgress(10);
      ui.showStatus("正在发送项目数据...", "info");

      const data = await apiService.convertText(
        projectFile,
        selectedQuotes,
        narratorName,
        appendSpaces,
        appendSpacesBeforeNewline,
      );
      const result = data.result;

      ui.showProgress(100);
      state.set("currentResult", result);
      document.getElementById("resultContent").textContent = result;
      Prism.highlightElement(document.getElementById("resultContent"));
      const resultSection = document.getElementById("resultSection");
      resultSection.classList.remove("hidden");
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
