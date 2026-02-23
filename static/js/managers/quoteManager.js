// 管理“去引号”选项：渲染引号复选框、保存选择、支持自定义引号对
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { DOMUtils } from "@utils/DOMUtils.js";
import { quoteStore } from "@stores/quoteStore.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";

export const quoteManager = {
  presetStates: {},

  // 初始化：绑定“添加自定义引号”按钮
  init() {
    const addButton = document.getElementById("addCustomQuoteBtn");
    if (addButton) {
      addButton.addEventListener("click", () =>
        this._addCustomQuote({
          openInputId: "customQuoteOpen",
          closeInputId: "customQuoteClose",
        }),
      );
    }
  },

  // 从本地读取自定义引号列表（并写入全局状态）
  loadCustomQuotes() {
    const savedQuotes = quoteStore.loadCustomQuotes();
    return savedQuotes.length > 0;
  },

  // 把“预设 + 自定义”引号渲染成一组复选框
  renderQuoteOptions() {
    const quoteOptionsContainer = document.getElementById("quoteOptionsContainer");
    if (!quoteOptionsContainer) return;
    DOMUtils.clearElement(quoteOptionsContainer);
    this.loadCustomQuotes();

    // 加载预设引号的保存状态
    this.presetStates = storageService.get(STORAGE_KEYS.PRESET_QUOTES_STATE, {});

    const fragment = document.createDocumentFragment();
    const quotesConfig = state.get("configData")?.quotes_config;
    if (quotesConfig && quotesConfig.quote_categories) {
      Object.entries(quotesConfig.quote_categories).forEach(
        ([categoryName, quoteCharacters]) => {
          const checkboxId = `quote-check-${categoryName.replace(/\s/g, "-")}`;
          // 使用保存的状态，如果没有保存则默认为选中
          const stateKey = `${quoteCharacters[0]}_${quoteCharacters[1]}`;
          const isChecked =
            this.presetStates[stateKey] !== undefined
              ? this.presetStates[stateKey]
              : true;
          const optionElement = this.createQuoteOptionElement(
            checkboxId,
            categoryName,
            quoteCharacters[0],
            quoteCharacters[1],
            isChecked
          );
          fragment.appendChild(optionElement);
        }
      );
    }
    quoteStore.getCustomQuotes().forEach((quote, index) => {
      const checkboxId = `quote-check-custom-saved-${index}`;
      const optionElement = this.createQuoteOptionElement(
        checkboxId,
        quote.name,
        quote.open,
        quote.close,
        quote.checked
      );
      fragment.appendChild(optionElement);
    });
    quoteOptionsContainer.appendChild(fragment);
    this.attachCheckboxListeners();
  },

  // 生成“一行引号选项”的 DOM（复选框 + 文案 + 可选删除按钮）
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
      const deleteButton = DOMUtils.createElement("button", {
        className: "btn-icon-action btn-icon-danger delete-quote-btn",
        title: "删除此引号对",
      });
      deleteButton.addEventListener("click", () =>
        this.removeCustomQuote(categoryName),
      );
      const icon = DOMUtils.createElement(
        "span",
        { className: "material-symbols-outlined" },
        "delete"
      );
      deleteButton.appendChild(icon);
      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);
      wrapper.appendChild(deleteButton);
    } else {
      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);
    }

    return wrapper;
  },

  // 给所有复选框绑定 change 事件（勾选变化就保存）
  attachCheckboxListeners() {
    document.querySelectorAll(".quote-option-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        this.handleCheckboxChange(checkbox);
      });
    });
  },

  // 当某个复选框勾选变化时：更新本地存储
  handleCheckboxChange(checkbox) {
    const openChar = checkbox.dataset.open;
    const closeChar = checkbox.dataset.close;
    if (!openChar || !closeChar) return;

    if (checkbox.id.includes("custom-saved")) {
      const quoteName = `${openChar}...${closeChar}`;
      quoteStore.updateCustomQuoteChecked(quoteName, checkbox.checked);
    } else {
      const stateKey = `${openChar}_${closeChar}`;
      this.presetStates[stateKey] = checkbox.checked;
      storageService.set(STORAGE_KEYS.PRESET_QUOTES_STATE, this.presetStates);
    }
  },

  // 删除某个自定义引号对，并重新渲染列表
  removeCustomQuote(quoteName) {
    quoteStore.removeCustomQuoteByName(quoteName);
    this.renderQuoteOptions();
    ui.showStatus("自定义引号已删除", "success");
  },

  // 收集当前勾选的引号对（交给后端做“去引号”）
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

  // 内部方法：新增一个自定义引号对（并刷新 UI）
  _addCustomQuote(options) {
    const { openInputId, closeInputId, onComplete } = options;
    const openChar = document.getElementById(openInputId).value;
    const closeChar = document.getElementById(closeInputId).value;

    if (!openChar || !closeChar) {
      ui.showStatus("起始和结束符号都不能为空！", "error");
      return;
    }

    const categoryName = `${openChar}...${closeChar}`;
    if (
      quoteStore.getCustomQuotes().some((quote) => quote.name === categoryName)
    ) {
      ui.showStatus("该引号对已存在！", "error");
      return;
    }

    const quotes = [
      ...quoteStore.getCustomQuotes(),
      {
        name: categoryName,
        open: openChar,
        close: closeChar,
        checked: true,
      },
    ];

    quoteStore.saveCustomQuotes(quotes);
    this.renderQuoteOptions();

    document.getElementById(openInputId).value = "";
    document.getElementById(closeInputId).value = "";
    ui.showStatus("自定义引号已添加", "success");
    if (onComplete) {
      onComplete();
    }
  },
};
