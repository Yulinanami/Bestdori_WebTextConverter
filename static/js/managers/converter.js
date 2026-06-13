// 点击转换：把文本/项目数据交给后端转换，并把结果显示出来（仅保留纯数据及业务，拆离了渲染层）
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { quoteManager } from "@managers/quoteManager.js";
import { apiService } from "@services/ApiService.js";
import { buildProjectData } from "@utils/ConverterCore.js";
import { converterView } from "@views/converterView.js";

export const converter = {
  // 初始化：委托给视图层绑定
  init() {
    converterView.init(this);
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

  // 收集输入内容与选项，并开始转换
  async convertText() {
    let projectFileToConvert;

    if (state.projectFile) {
      projectFileToConvert = state.projectFile;
    } else {
      // 委托给视图获取页面表单字段
      const { inputText } = converterView.getFormValues();
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
    const { narratorName, appendSpaces, padBeforeNewline } = converterView.getFormValues();

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
      converterView.setConvertLoading(true);
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

      // 委托给视图进行渲染
      converterView.displayResult(state.currentResult);
      ui.showStatus("转换完成！", "success");
    } catch (error) {
      ui.showStatus(error.message, "error");
    } finally {
      converterView.setConvertLoading(false);
    }
  },
};

