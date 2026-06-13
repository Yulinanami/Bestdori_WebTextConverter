// 引号配置数据管理器（仅保留数据映射与本地持久化，拆离了页面渲染）
import { state } from "@managers/stateManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { eventBus } from "@services/EventBus.js";
import { quoteView } from "@views/quoteView.js";

export const quoteManager = {
  presetStates: {},

  // 初始化：中转给界面渲染视图模块绑定事件
  init() {
    quoteView.init(this);
  },

  // 将当前自定义引号对持久化保存到本地缓存中
  persistCustomQuotes(quotes) {
    const nextQuotes = quotes ?? (state.customQuotes || []);
    state.customQuotes = nextQuotes;
    return storageService.save(STORAGE_KEYS.CUSTOM_QUOTES, nextQuotes);
  },

  // 从自定义列表中移除指定项数据
  removeCustomQuoteData(quoteName) {
    this.persistCustomQuotes(
      (state.customQuotes || []).filter((quote) => quote.name !== quoteName),
    );
  },

  // 往自定义列表中新增一项数据
  addCustomQuoteData(categoryName, openChar, closeChar) {
    const quotes = [
      ...(state.customQuotes || []),
      {
        name: categoryName,
        open: openChar,
        close: closeChar,
        checked: true,
      },
    ];
    this.persistCustomQuotes(quotes);
  },
  // 获取已选定用于剔除去重的符号列表数据
  listSelectedQuotes() {
    const selectedPairs = [];

    // 1. 处理预设引号
    const quotesConfig = state.configData?.quotes_config;
    if (quotesConfig && quotesConfig.quote_categories) {
      Object.values(quotesConfig.quote_categories).forEach(([openChar, closeChar]) => {
        const stateKey = `${openChar}_${closeChar}`;
        const isChecked = this.presetStates[stateKey] !== false;
        if (isChecked) {
          selectedPairs.push([openChar, closeChar]);
        }
      });
    }

    // 2. 处理自定义引号
    (state.customQuotes || []).forEach((quote) => {
      if (quote.checked !== false) {
        selectedPairs.push([quote.open, quote.close]);
      }
    });

    return selectedPairs;
  },
};

// 配置加载事件订阅：触发渲染
eventBus.on("config:loaded", () => {
  quoteView.renderQuoteOptions();
});

// 配置重置事件订阅：触发渲染
eventBus.on("config:reset", () => {
  quoteView.renderQuoteOptions();
});

// 配置导入事件订阅：导入处理并渲染
eventBus.on("config:imported", ({ config }) => {
  if (Array.isArray(config.custom_quotes)) {
    quoteManager.persistCustomQuotes(config.custom_quotes);
  }
  quoteView.renderQuoteOptions();
});
