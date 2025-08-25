// 引号管理相关功能
import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { converter } from "./converter.js";

export const quoteManager = {
  // 加载自定义引号
  loadCustomQuotes() {
    try {
      const saved = localStorage.getItem("bestdori_custom_quotes");
      if (saved) {
        state.set("customQuotes", JSON.parse(saved));
        return true;
      }
    } catch (error) {
      console.error("加载自定义引号失败:", error);
    }
    state.set("customQuotes", []);
    return false;
  },

  // 保存自定义引号到本地
  saveCustomQuotes() {
    try {
      localStorage.setItem(
        "bestdori_custom_quotes",
        JSON.stringify(state.get("customQuotes"))
      );
      return true;
    } catch (error) {
      console.error("保存自定义引号失败:", error);
      return false;
    }
  },

  // 渲染引号选项
  renderQuoteOptions() {
    const container = document.getElementById("quoteOptionsContainer");
    container.innerHTML = "";
    this.loadCustomQuotes();
    if (state.get("quotesConfig") && state.get("quotesConfig").quote_categories) {
      Object.entries(state.get("quotesConfig").quote_categories).forEach(
        ([categoryName, chars]) => {
          const checkboxId = `quote-check-${categoryName.replace(/\s/g, "-")}`;
          this.addQuoteOptionToContainer(
            container,
            checkboxId,
            categoryName,
            chars[0],
            chars[1],
            true
          );
        }
      );
    }
    state.get("customQuotes").forEach((quote, index) => {
      const checkboxId = `quote-check-custom-saved-${index}`;
      this.addQuoteOptionToContainer(
        container,
        checkboxId,
        quote.name,
        quote.open,
        quote.close,
        quote.checked
      );
    });
  },

  // 辅助函数：添加引号选项到指定容器
  addQuoteOptionToContainer(
    container,
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
      deleteBtn.className = "btn btn-sm";
      deleteBtn.style.background = "#fee";
      deleteBtn.style.color = "#e53e3e";
      deleteBtn.style.marginLeft = "10px";
      deleteBtn.style.padding = "2px 8px";
      deleteBtn.style.fontSize = "0.8rem";
      deleteBtn.textContent = "删除";
      deleteBtn.onclick = () => this.removeCustomQuote(categoryName);
      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);
      wrapper.appendChild(deleteBtn);
    } else {
      wrapper.appendChild(checkbox);
      wrapper.appendChild(label);
    }
    container.appendChild(wrapper);
  },

  // 删除自定义引号
  removeCustomQuote(quoteName) {
    const currentStates = {};
    document.querySelectorAll(".quote-option-checkbox").forEach((checkbox) => {
      const key = `${checkbox.dataset.open}_${checkbox.dataset.close}`;
      currentStates[key] = checkbox.checked;
    });
    state.set("customQuotes", state.get("customQuotes").filter((q) => q.name !== quoteName));
    this.saveCustomQuotes();
    this.renderQuoteOptions();
    document.querySelectorAll(".quote-option-checkbox").forEach((checkbox) => {
      const key = `${checkbox.dataset.open}_${checkbox.dataset.close}`;
      if (key in currentStates) {
        checkbox.checked = currentStates[key];
      }
    });
    const splitModal = document.getElementById("splitQuoteModal");
    if (splitModal && splitModal.style.display !== "none") {
      const mainContainer = document.getElementById("quoteOptionsContainer");
      const splitContainer = document.getElementById(
        "splitQuoteOptionsContainer"
      );
      splitContainer.innerHTML = "";
      mainContainer
        .querySelectorAll(".quote-option-checkbox")
        .forEach((mainCheckbox, index) => {
          const wrapper = mainCheckbox.parentElement.cloneNode(true);
          const checkbox = wrapper.querySelector(".quote-option-checkbox");
          const label = wrapper.querySelector("label");
          const newId = `split-${checkbox.id}`;
          checkbox.id = newId;
          label.htmlFor = newId;
          checkbox.checked = mainCheckbox.checked;
          checkbox.addEventListener("change", () => {
            mainCheckbox.checked = checkbox.checked;
            if (state.get("autoPreviewEnabled")) {
              converter.updateSplitPreview();
            }
          });
          const deleteBtn = wrapper.querySelector("button");
          if (deleteBtn && deleteBtn.textContent === "删除") {
            const btnQuoteName = label.textContent;
            deleteBtn.onclick = () => {
              this.removeCustomQuote(btnQuoteName);
            };
          }
          splitContainer.appendChild(wrapper);
        });
    }
    ui.showStatus("自定义引号已删除", "success");
  },

  // 获取选中的引号对
  getSelectedQuotes() {
    const selectedPairs = [];
    document.querySelectorAll(".quote-option-checkbox").forEach((checkbox) => {
      const openChar = checkbox.dataset.open;
      const closeChar = checkbox.dataset.close;
      if (checkbox.id.includes("custom-saved")) {
        const quoteName = `${openChar}...${closeChar}`;
        const customQuote = state.get("customQuotes").find(
          (q) => q.name === quoteName
        );
        if (customQuote) {
          customQuote.checked = checkbox.checked;
        }
      }
      if (checkbox.checked && openChar && closeChar) {
        selectedPairs.push([openChar, closeChar]);
      }
    });
    this.saveCustomQuotes();
    return selectedPairs;
  },

  // 私有辅助函数：添加自定义引号并处理UI更新
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

    // 1. 保存当前复选框的状态
    const currentStates = {};
    document
      .querySelector(stateContainerSelector)
      .querySelectorAll(".quote-option-checkbox")
      .forEach((checkbox) => {
        const key = `${checkbox.dataset.open}_${checkbox.dataset.close}`;
        currentStates[key] = checkbox.checked;
      });

    // 2. 添加新引号到数据模型
    const quotes = state.get("customQuotes");
    quotes.push({
      name: categoryName,
      open: openChar,
      close: closeChar,
      checked: true,
    });
    state.set("customQuotes", quotes);
    this.saveCustomQuotes();

    // 3. 重新渲染主列表
    this.renderQuoteOptions();

    // 4. 恢复主列表的复选框状态
    document
      .querySelectorAll("#quoteOptionsContainer .quote-option-checkbox")
      .forEach((checkbox) => {
        const key = `${checkbox.dataset.open}_${checkbox.dataset.close}`;
        if (key in currentStates) {
          checkbox.checked = currentStates[key];
        }
      });

    // 5. 清理和收尾
    document.getElementById(openInputId).value = "";
    document.getElementById(closeInputId).value = "";
    ui.showStatus("自定义引号已添加", "success");

    // 6. 执行回调
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

  // 打开分屏引号设置模态框
  openSplitQuoteModal() {
    const mainContainer = document.getElementById("quoteOptionsContainer");
    const splitContainer = document.getElementById(
      "splitQuoteOptionsContainer"
    );
    splitContainer.innerHTML = "";
    mainContainer
      .querySelectorAll(".quote-option-checkbox")
      .forEach((mainCheckbox, index) => {
        const wrapper = mainCheckbox.parentElement.cloneNode(true);
        const checkbox = wrapper.querySelector(".quote-option-checkbox");
        const label = wrapper.querySelector("label");
        const newId = `split-${checkbox.id}`;
        checkbox.id = newId;
        label.htmlFor = newId;
        checkbox.checked = mainCheckbox.checked;
        checkbox.addEventListener("change", () => {
          mainCheckbox.checked = checkbox.checked;
          if (state.get("autoPreviewEnabled")) {
            converter.updateSplitPreview();
          }
        });
        const deleteBtn = wrapper.querySelector("button");
        if (deleteBtn && deleteBtn.textContent === "删除") {
          const quoteName = label.textContent;
          deleteBtn.onclick = () => {
            this.removeCustomQuote(quoteName);
          };
        }
        splitContainer.appendChild(wrapper);
      });

    ui.openModal("splitQuoteModal");
  },

  // 添加分屏自定义引号选项
  addSplitCustomQuoteOption() {
    this._addCustomQuote({
      openInputId: "splitCustomQuoteOpen",
      closeInputId: "splitCustomQuoteClose",
      stateContainerSelector: "#splitQuoteOptionsContainer",
      onComplete: () => {
        this.openSplitQuoteModal();
        if (state.get("autoPreviewEnabled")) {
          converter.updateSplitPreview();
        }
      },
    });
  },
};