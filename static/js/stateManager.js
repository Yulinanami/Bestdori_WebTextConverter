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
};

export const state = {
  get(key) {
    return _state[key];
  },
  set(key, value) {
    // console.log(`[State Change] ${key}:`, value); // 方便调试
    _state[key] = value;
    // 在这里可以触发一些全局的响应，如果需要的话
  },
  getAll() {
    return { ..._state };
  },
};
