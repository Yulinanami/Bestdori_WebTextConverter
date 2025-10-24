// 引号管理相关功能
import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { converter } from "./converter.js";
import { storageService, STORAGE_KEYS } from "./services/StorageService.js";
import { DOMUtils } from "./utils/DOMUtils.js";

export const quoteManager = {
  // 加载自定义引号
  loadCustomQuotes() {
    const saved = storageService.get(STORAGE_KEYS.CUSTOM_QUOTES, []);
    state.set("customQuotes", saved);
    return saved.length > 0;
  },

  // 保存自定义引号到本地
  saveCustomQuotes() {
    return storageService.set(
      STORAGE_KEYS.CUSTOM_QUOTES,
      state.get("customQuotes")
    );
  },

  // 加载预设引号的选中状态
  loadPresetQuotesState() {
    return storageService.get(STORAGE_KEYS.PRESET_QUOTES_STATE, {});
  },

  // 保存预设引号的选中状态
  savePresetQuotesState(stateMap) {
    return storageService.set(STORAGE_KEYS.PRESET_QUOTES_STATE, stateMap);
  },

  // 渲染引号选项
  renderQuoteOptions() {
    const container = document.getElementById("quoteOptionsContainer");
    if (!container) return;
    DOMUtils.clearElement(container);
    this.loadCustomQuotes();

    // 加载预设引号的保存状态
    const presetStates = this.loadPresetQuotesState();

    const fragment = document.createDocumentFragment();
    const quotesConfig = state.get("configData")?.quotes_config;
    if (quotesConfig && quotesConfig.quote_categories) {
      Object.entries(quotesConfig.quote_categories).forEach(
        ([categoryName, chars]) => {
          const checkboxId = `quote-check-${categoryName.replace(/\s/g, "-")}`;
          // 使用保存的状态，如果没有保存则默认为选中
          const stateKey = `${chars[0]}_${chars[1]}`;
          const isChecked = presetStates[stateKey] !== undefined ? presetStates[stateKey] : true;
          const element = this.createQuoteOptionElement(
            checkboxId,
            categoryName,
            chars[0],
            chars[1],
            isChecked
          );
          fragment.appendChild(element);
        }
      );
    }
    state.get("customQuotes").forEach((quote, index) => {
      const checkboxId = `quote-check-custom-saved-${index}`;
      const element = this.createQuoteOptionElement(
        checkboxId,
        quote.name,
        quote.open,
        quote.close,
        quote.checked
      );
      fragment.appendChild(element);
    });
    container.appendChild(fragment);
    this.attachCheckboxListeners();
  },

  // 为所有引号复选框添加事件监听器
  attachCheckboxListeners() {
    document.querySelectorAll(".quote-option-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        this.saveQuoteStates();
      });
    });
  },

  // 保存所有引号的状态
  saveQuoteStates() {
    const presetStates = {};
    document.querySelectorAll(".quote-option-checkbox").forEach((checkbox) => {
      const openChar = checkbox.dataset.open;
      const closeChar = checkbox.dataset.close;
      const stateKey = `${openChar}_${closeChar}`;

      if (checkbox.id.includes("custom-saved")) {
        const quoteName = `${openChar}...${closeChar}`;
        const customQuote = state
          .get("customQuotes")
          .find((q) => q.name === quoteName);
        if (customQuote) {
          customQuote.checked = checkbox.checked;
        }
      } else {
        presetStates[stateKey] = checkbox.checked;
      }
    });
    this.saveCustomQuotes();
    this.savePresetQuotesState(presetStates);
  },

  // 辅助函数：创建引号选项元素
  createQuoteOptionElement(
    checkboxId,
    categoryName,
    openChar,
    closeChar,
    checked
  ) {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.marginBottom = "8px";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = checkboxId;
    checkbox.dataset.open = openChar;
    checkbox.dataset.close = closeChar;
    checkbox.className = "quote-option-checkbox";
    checkbox.checked = checked;
    const label = document.createElement("label");
    label.htmlFor = checkboxId;
    label.textContent = categoryName;
    label.style.marginLeft = "8px";
    label.style.cursor = "pointer";
    label.style.flex = "1";
    if (checkboxId.includes("custom")) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-sm btn-danger delete-quote-btn";
      deleteBtn.style.marginLeft = "10px";
      deleteBtn.textContent = "删除";
      deleteBtn.onclick = () => this.removeCustomQuote(categoryName);
      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);
      wrapper.appendChild(deleteBtn);
    } else {
      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);
    }
    return wrapper;
  },

  // 删除自定义引号
  removeCustomQuote(quoteName) {
    const currentStates = {};
    const presetStates = {};

    document.querySelectorAll(".quote-option-checkbox").forEach((checkbox) => {
      const key = `${checkbox.dataset.open}_${checkbox.dataset.close}`;
      currentStates[key] = checkbox.checked;
      // 同时记录预设引号的状态
      if (!checkbox.id.includes("custom-saved")) {
        presetStates[key] = checkbox.checked;
      }
    });

    state.set(
      "customQuotes",
      state.get("customQuotes").filter((q) => q.name !== quoteName)
    );
    this.saveCustomQuotes();
    this.savePresetQuotesState(presetStates);
    this.renderQuoteOptions();

    document.querySelectorAll(".quote-option-checkbox").forEach((checkbox) => {
      const key = `${checkbox.dataset.open}_${checkbox.dataset.close}`;
      if (key in currentStates) {
        checkbox.checked = currentStates[key];
      }
    });
    ui.showStatus("自定义引号已删除", "success");
  },

  // 获取选中的引号对
  getSelectedQuotes() {
    const selectedPairs = [];

    document.querySelectorAll(".quote-option-checkbox").forEach((checkbox) => {
      const openChar = checkbox.dataset.open;
      const closeChar = checkbox.dataset.close;

      if (checkbox.checked && openChar && closeChar) {
        selectedPairs.push([openChar, closeChar]);
      }
    });

    return selectedPairs;
  },

  // 添加自定义引号并处理UI更新
  _addCustomQuote(options) {
    const { openInputId, closeInputId, stateContainerSelector, onComplete } =
      options;
    const openChar = document.getElementById(openInputId).value;
    const closeChar = document.getElementById(closeInputId).value;
    if (!openChar || !closeChar) {
      ui.showStatus("起始和结束符号都不能为空！", "error");
      return;
    }
    const categoryName = `${openChar}...${closeChar}`;
    if (state.get("customQuotes").some((q) => q.name === categoryName)) {
      ui.showStatus("该引号对已存在！", "error");
      return;
    }
    const currentStates = {};
    const presetStates = {};
    document
      .querySelector(stateContainerSelector)
      .querySelectorAll(".quote-option-checkbox")
      .forEach((checkbox) => {
        const key = `${checkbox.dataset.open}_${checkbox.dataset.close}`;
        currentStates[key] = checkbox.checked;
        // 同时记录预设引号的状态
        if (!checkbox.id.includes("custom-saved")) {
          presetStates[key] = checkbox.checked;
        }
      });
    const quotes = state.get("customQuotes");
    quotes.push({
      name: categoryName,
      open: openChar,
      close: closeChar,
      checked: true,
    });
    state.set("customQuotes", quotes);
    this.saveCustomQuotes();
    this.savePresetQuotesState(presetStates);
    this.renderQuoteOptions();
    document
      .querySelectorAll("#quoteOptionsContainer .quote-option-checkbox")
      .forEach((checkbox) => {
        const key = `${checkbox.dataset.open}_${checkbox.dataset.close}`;
        if (key in currentStates) {
          checkbox.checked = currentStates[key];
        }
      });
    document.getElementById(openInputId).value = "";
    document.getElementById(closeInputId).value = "";
    ui.showStatus("自定义引号已添加", "success");
    if (onComplete) {
      onComplete();
    }
  },

  // 添加自定义引号选项
  addCustomQuoteOption() {
    this._addCustomQuote({
      openInputId: "customQuoteOpen",
      closeInputId: "customQuoteClose",
      stateContainerSelector: "#quoteOptionsContainer",
    });
  },
};
