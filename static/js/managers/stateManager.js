// 全局状态仓库：用来在各模块之间共享数据
const _state = {
  currentResult: "",
  currentConfig: {},
  customQuotes: [],
  currentCostumes: {},
  projectFile: null,
};

export const state = {
  // 读取某个状态值（key 不存在时返回 undefined）
  get(key) {
    return _state[key];
  },

  // 写入某个状态值（会直接覆盖旧值）
  set(key, value) {
    _state[key] = value;
  },
};
