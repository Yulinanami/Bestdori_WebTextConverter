// 全局共享状态（带变更追踪）
import { eventBus } from "@services/EventBus.js";

const _rawState = {
  currentResult: "",
  currentConfig: {},
  customQuotes: [],
  currentCostumes: {},
  configData: null,
  avatarMapping: {},
  projectFile: null,
};

// 用 Proxy 拦截写入，自动通知变更
export const state = new Proxy(_rawState, {
  set(target, key, value) {
    const oldValue = target[key];
    target[key] = value;

    // 值确实变了才发通知，避免无效触发
    if (oldValue !== value) {
      eventBus.emit(`state:${key}`, { key, value, oldValue });
    }
    return true;
  },
});

