// 状态管理
const _state = {
  currentResult: "",
  currentConfig: {},
  quotesConfig: {},
  customQuotes: [],
  batchFiles: [],
  batchResults: [],
  autoPreviewEnabled: true,
  previewDebounceTimer: null,
  enableLive2D: false,
  currentCostumes: {},
  projectFile: null, 
};

export const state = {
  get(key) {
    return _state[key];
  },
  set(key, value) {
    // console.log(`[State Change] ${key}:`, value); // 方便调试
    _state[key] = value;
  },
  getAll() {
    return { ..._state };
  },
};
