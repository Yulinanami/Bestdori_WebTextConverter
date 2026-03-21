// 点击转换：把文本/项目数据交给后端转换，并把结果显示出来
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { quoteManager } from "@managers/quoteManager.js";
import { apiService } from "@services/ApiService.js";
import { buildProjectData } from "@utils/ConverterCore.js";

export const converter = {
  // 初始化：绑定“转换”按钮
  init() {
    document
      .getElementById("convertBtn")
      ?.addEventListener("click", this.convertText.bind(this));
    document
      .getElementById("copyBtn")
      ?.addEventListener("click", this.copyResult.bind(this));
  },

  // 复制当前转换结果 JSON
  async copyResult() {
    if (!state.currentResult) {
      ui.showStatus("没有可复制的结果！", "error");
      return;
    }

    if (await ui.copyToClipboard(state.currentResult)) {
      ui.showStatus("转换结果已复制到剪贴板！", "success");
      return;
    }
    ui.showStatus("复制失败，请手动选择复制。", "error");
  },

  // 收集输入内容与选项，并开始转换（文本模式或“已保存的项目模式”）
  async convertText() {
    let projectFileToConvert;

    if (state.projectFile) {
      projectFileToConvert = state.projectFile;
    } else {
      const inputText = document.getElementById("inputText").value.trim();
      if (!inputText) {
        ui.showStatus("请输入要转换的文本！", "error");
        return;
      }
      projectFileToConvert = buildProjectData(
        inputText,
        state.currentConfig,
      );
    }

    const selectedQuotes = quoteManager.listSelectedQuotes();
    // 如果用户没有输入旁白名称，发送空字符串让后端使用配置默认值
    const narratorName =
      document.getElementById("narratorName").value.trim() || "";
    const appendSpaces = parseInt(document.getElementById("appendSpaces").value) || 0;
    const padBeforeNewline =
      parseInt(document.getElementById("appendSpacesBeforeNewline").value) || 0;

    this.convertProject(
      projectFileToConvert,
      selectedQuotes,
      narratorName,
      appendSpaces,
      padBeforeNewline,
    );
  },

// 把项目文件发到后端再把结果放到页面上
  async convertProject(
    projectFile,
    selectedQuotes = [],
    narratorName,
    appendSpaces = 0,
    padBeforeNewline = 0,
  ) {
    try {
      ui.toggleButtonLoading("convertBtn", true, "转换中...");
      ui.showStatus("正在发送项目数据...", "info");

      // 把当前内容发给后端转换
      const convertResponse = await apiService.convertText(
        projectFile,
        selectedQuotes,
        narratorName,
        appendSpaces,
        padBeforeNewline,
      );
      state.currentResult = convertResponse.result;
      document.getElementById("resultSection")?.classList.remove("hidden");
      ui.renderResultCode("resultContent", state.currentResult);
      ui.showStatus("转换完成！", "success");
    } catch (error) {
      ui.showStatus(error.message, "error");
    } finally {
      ui.toggleButtonLoading("convertBtn", false);
    }
  },
};
