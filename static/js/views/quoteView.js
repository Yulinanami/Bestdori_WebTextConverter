// 引号去重渲染界面管理（拆分自原去引号选项管理器）
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { DOMUtils } from "@utils/DOMUtils.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";

export const quoteView = {
  manager: null,

  // 初始化绑定事件监听
  init(manager) {
    this.manager = manager;
    document.getElementById("addCustomQuoteBtn")?.addEventListener(
      "click",
      () =>
        this.addCustomQuote({
          openInputId: "customQuoteOpen",
          closeInputId: "customQuoteClose",
        }),
    );
  },

  // 渲染所有引号去重选项列表
  renderQuoteOptions() {
    if (!this.manager) return;
    const optionsBox = document.getElementById("quoteOptionsContainer");
    if (!optionsBox) return;
    DOMUtils.clearElement(optionsBox);
    state.customQuotes = storageService.load(STORAGE_KEYS.CUSTOM_QUOTES, []);

    // 加载预设引号的保存状态
    this.manager.presetStates = storageService.load(STORAGE_KEYS.PRESET_QUOTES_STATE, {});

    const fragment = document.createDocumentFragment();
    const quotesConfig = state.configData?.quotes_config;
    if (quotesConfig && quotesConfig.quote_categories) {
      Object.entries(quotesConfig.quote_categories).forEach(
        ([categoryName, quoteCharacters]) => {
          const checkboxId = `quote-check-${categoryName.replace(/\s/g, "-")}`;
          const stateKey = `${quoteCharacters[0]}_${quoteCharacters[1]}`;
          const isChecked =
            this.manager.presetStates[stateKey] !== undefined
              ? this.manager.presetStates[stateKey]
              : true;
          const optionElement = this.createQuoteOption(
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
    (state.customQuotes || []).forEach((quote, index) => {
      const checkboxId = `quote-check-custom-saved-${index}`;
      const optionElement = this.createQuoteOption(
        checkboxId,
        quote.name,
        quote.open,
        quote.close,
        quote.checked
      );
      fragment.appendChild(optionElement);
    });
    optionsBox.appendChild(fragment);
    document.querySelectorAll(".quote-option-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        this.handleCheckboxChange(checkbox);
      });
    });
  },

  // 动态创建单行引号复选框与删除按钮的 DOM
  createQuoteOption(
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

  // 复选框变化时通知数据层
  handleCheckboxChange(checkbox) {
    if (!this.manager) return;
    const openChar = checkbox.dataset.open;
    const closeChar = checkbox.dataset.close;
    if (!openChar || !closeChar) return;

    if (checkbox.id.includes("custom-saved")) {
      const quoteName = `${openChar}...${closeChar}`;
      this.manager.persistCustomQuotes(
        (state.customQuotes || []).map((quote) =>
          quote.name === quoteName ? { ...quote, checked: checkbox.checked } : quote
        ),
      );
    } else {
      const stateKey = `${openChar}_${closeChar}`;
      this.manager.presetStates[stateKey] = checkbox.checked;
      storageService.save(STORAGE_KEYS.PRESET_QUOTES_STATE, this.manager.presetStates);
    }
  },

  // 自定义删除的 UI 反馈
  removeCustomQuote(quoteName) {
    if (!this.manager) return;
    this.manager.removeCustomQuoteData(quoteName);
    this.renderQuoteOptions();
    ui.showStatus("自定义引号已删除", "success");
  },

  // 页面上添加自定义引号
  addCustomQuote(options) {
    if (!this.manager) return;
    const { openInputId, closeInputId, onComplete } = options;
    const openChar = document.getElementById(openInputId)?.value;
    const closeChar = document.getElementById(closeInputId)?.value;

    if (!openChar || !closeChar) {
      ui.showStatus("起始和结束符号都不能为空！", "error");
      return;
    }

    const categoryName = `${openChar}...${closeChar}`;
    if ((state.customQuotes || []).some((quote) => quote.name === categoryName)) {
      ui.showStatus("该引号对已存在！", "error");
      return;
    }

    this.manager.addCustomQuoteData(categoryName, openChar, closeChar);
    this.renderQuoteOptions();

    const openInput = document.getElementById(openInputId);
    const closeInput = document.getElementById(closeInputId);
    if (openInput) openInput.value = "";
    if (closeInput) closeInput.value = "";
    ui.showStatus("自定义引号已添加", "success");
    if (onComplete) {
      onComplete();
    }
  },
};
