// 全局状态管理
const _state = {
  currentResult: "",
  currentConfig: {},
  customQuotes: [],
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
};
