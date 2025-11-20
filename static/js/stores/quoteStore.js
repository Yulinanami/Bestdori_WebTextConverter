import { state } from "../stateManager.js";
import { storageService, STORAGE_KEYS } from "../services/StorageService.js";

// 独立的引号数据存储与持久化层，避免 UI 逻辑直接依赖 storage/state
export const quoteStore = {
  loadCustomQuotes() {
    const saved = storageService.get(STORAGE_KEYS.CUSTOM_QUOTES, []);
    state.set("customQuotes", saved);
    return saved;
  },

  getCustomQuotes() {
    return state.get("customQuotes") || [];
  },

  saveCustomQuotes(quotes = this.getCustomQuotes()) {
    state.set("customQuotes", quotes);
    return storageService.set(STORAGE_KEYS.CUSTOM_QUOTES, quotes);
  },

  removeCustomQuoteByName(name) {
    const filtered = this.getCustomQuotes().filter((q) => q.name !== name);
    return this.saveCustomQuotes(filtered);
  },

  updateCustomQuoteChecked(name, checked) {
    const updated = this.getCustomQuotes().map((quote) =>
      quote.name === name ? { ...quote, checked } : quote
    );
    return this.saveCustomQuotes(updated);
  },

  getPresetStates() {
    return storageService.get(STORAGE_KEYS.PRESET_QUOTES_STATE, {});
  },

  savePresetStates(stateMap) {
    return storageService.set(STORAGE_KEYS.PRESET_QUOTES_STATE, stateMap);
  },
};
