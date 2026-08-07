// 转换与格式化界面渲染管理
import { ui } from "@utils/uiUtils.js";
import { state } from "@managers/stateManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";

export const converterView = {
  manager: null,

  // 把空格数量限制为可安全处理的非负整数
  normalizeSpaceCount(value) {
    const parsedValue = Number.parseInt(value, 10);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) return 0;
    return Math.min(parsedValue, 10000);
  },

  // 初始化绑定事件监听
  init(manager) {
    this.manager = manager;

    document
      .getElementById("convertBtn")
      ?.addEventListener("click", () => this.manager.convertText());

    document
      .getElementById("copyBtn")
      ?.addEventListener("click", () => this.manager.copyResult());

    // 绑定原属于 viewManager.js 的格式化按钮事件
    document
      .getElementById("formatTextBtn")
      ?.addEventListener("click", () => this.formatText());

    // 初始化自动保存参数输入框
    this.initAutoSaveInputs();
  },

  // 初始化数字输入框的自动保存与回写
  initAutoSaveInputs() {
    [
      {
        inputElementId: "appendSpaces",
        storageKey: STORAGE_KEYS.AUTO_APPEND_SPACES,
      },
      {
        inputElementId: "appendSpacesBeforeNewline",
        storageKey: STORAGE_KEYS.AUTO_APPEND_SPACES_BEFORE_NEWLINE,
      },
    ].forEach(({ inputElementId, storageKey }) => {
      const numericInput = document.getElementById(inputElementId);
      if (!numericInput) return;

      numericInput.value = this.normalizeSpaceCount(
        storageService.load(storageKey, 0),
      );

      numericInput.addEventListener("input", (inputEvent) => {
        storageService.save(
          storageKey,
          this.normalizeSpaceCount(inputEvent.target.value),
        );
      });
    });
  },

  // 提供更新数字输入框值的接口
  updateNumericInput(inputId, value) {
    const numericInput = document.getElementById(inputId);
    if (numericInput) {
      numericInput.value = String(value);
    }
  },

  // 获取页面输入的表单参数对象
  getFormValues() {
    const inputText = document.getElementById("inputText")?.value.trim() || "";
    const narratorName = document.getElementById("narratorName")?.value.trim() || "";
    const appendSpaces = this.normalizeSpaceCount(
      document.getElementById("appendSpaces")?.value,
    );
    const padBeforeNewline = this.normalizeSpaceCount(
      document.getElementById("appendSpacesBeforeNewline")?.value,
    );

    return {
      inputText,
      narratorName,
      appendSpaces,
      padBeforeNewline,
    };
  },

  // 回写输入框的文本
  setInputText(text) {
    const inputTextElement = document.getElementById("inputText");
    if (inputTextElement) {
      inputTextElement.value = text;
    }
  },

  // 设置转换按钮加载动效状态
  setConvertLoading(isLoading) {
    ui.toggleButtonLoading("convertBtn", isLoading, "转换中...");
  },

  // 渲染显示转换成功后的 JSON 结果
  displayResult(resultText) {
    document.getElementById("resultSection")?.classList.remove("hidden");
    ui.renderResultCode("resultContent", resultText);
  },

  // 格式化文本框文本逻辑（合并自 viewManager.js）
  formatText() {
    const textarea = document.getElementById("inputText");
    if (!textarea) return;

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
