import { state } from "./stateManager.js";
import { ui } from "../utils/uiUtils.js";

class GenericConfigManager {
  constructor(name, configKey, localStorageKey) {
    this.name = name;
    this.configKey = configKey;
    this.localStorageKey = localStorageKey;
    this.characterItems = {};
    this.customItems = this.loadCustomItems();
  }

  init() {
    const configData = state.get("configData");
    if (configData && configData[this.configKey]) {
      this.characterItems = configData[this.configKey];
    } else {
      console.warn(`配置中未找到 ${this.configKey}。`);
    }
  }

  loadCustomItems() {
    try {
      const saved = localStorage.getItem(this.localStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error(`加载自定义 ${this.name} 失败:`, e);
      return [];
    }
  }

  saveCustomItems() {
    try {
      localStorage.setItem(
        this.localStorageKey,
        JSON.stringify(this.customItems)
      );
    } catch (e) {
      ui.showStatus(`保存自定义 ${this.name} 失败`, "error");
    }
  }

  getAllDefaultItems() {
    const defaultItems = new Set();
    Object.values(this.characterItems).forEach((list) => {
      list.forEach((item) => defaultItems.add(item));
    });
    return defaultItems;
  }

  /**
   * 获取指定角色可用的所有项目列表（默认 + 全局自定义）
   * @param {number | string} characterId - 角色的 ID
   * @returns {string[]} - 可用项目列表
   */
  getAvailableItemsForCharacter(characterId) {
    const defaultItems = this.characterItems[characterId] || [];
    // 使用 Set 确保唯一性
    return Array.from(new Set([...defaultItems, ...this.customItems])).sort();
  }

  getAllKnownItems() {
    const allItems = new Set(this.customItems);
    Object.values(this.characterItems).forEach((list) => {
      list.forEach((item) => allItems.add(item));
    });
    return Array.from(allItems).sort();
  }
}

export const motionManager = new GenericConfigManager(
  "动作",
  "character_motions",
  "bestdori_custom_motions"
);

export const expressionManager = new GenericConfigManager(
  "表情",
  "character_expressions",
  "bestdori_custom_expressions"
);
