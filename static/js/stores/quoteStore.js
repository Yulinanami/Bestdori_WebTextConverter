import { state } from "@managers/stateManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";

// 引号数据仓库：负责读写 localStorage，并把结果同步到全局 state
export const quoteStore = {
  // 从本地读取自定义引号列表，并写入 state
  loadCustomQuotes() {
    const saved = storageService.get(STORAGE_KEYS.CUSTOM_QUOTES, []);
    state.set("customQuotes", saved);
    return saved;
  },

  // 获取当前自定义引号列表（来自 state）
  getCustomQuotes() {
    return state.get("customQuotes") || [];
  },

  // 保存自定义引号列表（写入 state + localStorage）
  saveCustomQuotes(quotes = quoteStore.getCustomQuotes()) {
    state.set("customQuotes", quotes);
    return storageService.set(STORAGE_KEYS.CUSTOM_QUOTES, quotes);
  },

  // 按名字删除一个自定义引号对
  removeCustomQuoteByName(name) {
    const filtered = quoteStore.getCustomQuotes().filter(
      (quote) => quote.name !== name
    );
    return this.saveCustomQuotes(filtered);
  },

  // 更新某个自定义引号的“是否勾选”状态
  updateCustomQuoteChecked(name, checked) {
    const updated = quoteStore.getCustomQuotes().map((quote) =>
      quote.name === name ? { ...quote, checked } : quote
    );
    return this.saveCustomQuotes(updated);
  },

};
