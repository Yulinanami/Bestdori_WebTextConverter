// static/js/genericConfigManager.js (新建文件)

import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";

/**
 * 一个通用的配置管理器工厂函数。
 * @param {object} config - 配置对象。
 * @param {string} config.name - 管理器的名称 (例如 "动作", "表情")。
 * @param {string} config.stateKey - 在全局 state 中存储默认列表的键 (例如 "motionsConfig")。
 * @param {string} config.storageKey - 在 localStorage 中存储自定义列表的键。
 * @returns {object} - 返回一个功能完整的管理器实例。
 */
function createGenericManager(config) {
  const { name, stateKey, storageKey } = config;

  return {
    defaultItems: [],
    customItems: [],

    init() {
      this.defaultItems = state.get(stateKey) || [];
      this.loadCustomItems();
    },

    loadCustomItems() {
      try {
        const saved = localStorage.getItem(storageKey);
        this.customItems = saved ? JSON.parse(saved) : [];
      } catch (error) {
        console.error(`加载自定义${name}失败:`, error);
        this.customItems = [];
      }
    },

    saveCustomItems() {
      try {
        localStorage.setItem(storageKey, JSON.stringify(this.customItems));
      } catch (error) {
        console.error(`保存自定义${name}失败:`, error);
        ui.showStatus(`保存自定义${name}失败`, "error");
      }
    },

    getAvailableItems() {
      const all = new Set([...this.defaultItems, ...this.customItems]);
      return Array.from(all).sort();
    },

    addCustomItem(itemId) {
      const trimmedId = itemId.trim();
      if (!trimmedId) {
        ui.showStatus(`${name}ID不能为空！`, "error");
        return false;
      }
      if (this.customItems.includes(trimmedId) || this.defaultItems.includes(trimmedId)) {
        ui.showStatus(`该${name}ID已存在！`, "error");
        return false;
      }
      this.customItems.push(trimmedId);
      this.saveCustomItems();
      ui.showStatus(`自定义${name}已添加。`, "success");
      return true;
    },

    deleteCustomItem(itemId) {
      this.customItems = this.customItems.filter(item => item !== itemId);
      this.saveCustomItems();
      ui.showStatus(`自定义${name}已删除。`, "success");
    }
  };
}

// --- 创建并导出具体的管理器实例 ---
export const motionManager = createGenericManager({
  name: "动作",
  stateKey: "motionsConfig",
  storageKey: "bestdori_custom_motions"
});

export const expressionManager = createGenericManager({
  name: "表情",
  stateKey: "expressionsConfig",
  storageKey: "bestdori_custom_expressions"
});