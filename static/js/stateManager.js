// 全局状态管理
const _state = {
  currentResult: "",
  currentConfig: {},
  quotesConfig: {},
  customQuotes: [],
  batchFiles: [],
  batchResults: [],
  autoPreviewEnabled: true,
  previewDebounceTimer: null,
  currentCostumes: {},
  projectFile: null,
};

export const state = {
  get(key) {
    return _state[key];
  },
  set(key, value) {
    _state[key] = value;
  },
  getAll() {
    return { ..._state };
  },
};
