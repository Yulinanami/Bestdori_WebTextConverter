import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";

// 用于动作/表情等类似的数据结构
class GenericConfigManager {
  constructor(name, configKey, localStorageKey) {
    // 初始化：记住配置字段名，并加载本地自定义项
    this.name = name;
    this.configKey = configKey;
    this.localStorageKey = localStorageKey;
    this.characterItems = {};
    this.customItems = this.loadCustomItems();
  }

  // 从后端下发的 configData 里读取“每个角色的默认列表”
  init() {
    const configData = state.get("configData");
    if (configData && configData[this.configKey]) {
      this.characterItems = configData[this.configKey];
    } else {
      console.warn(`配置中未找到 ${this.configKey}。`);
    }
  }

  // 从 localStorage 读取用户自定义项
  loadCustomItems() {
    try {
      const saved = localStorage.getItem(this.localStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error(`加载自定义 ${this.name} 失败:`, e);
      return [];
    }
  }

  // 把用户自定义项保存到 localStorage
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

  // 获取“所有角色默认项”的去重集合（Set）
  getAllDefaultItems() {
    const defaultItems = new Set();
    Object.values(this.characterItems).forEach((list) => {
      list.forEach((item) => defaultItems.add(item));
    });
    return defaultItems;
  }

  // 获取某个角色可用的项目列表（默认 + 全局自定义，去重后排序）
  getAvailableItemsForCharacter(characterId) {
    const defaultItems = this.characterItems[characterId] || [];
    // 使用 Set 确保唯一性
    return Array.from(new Set([...defaultItems, ...this.customItems])).sort();
  }

  // 获取“所有已知项目”（默认 + 自定义，去重后排序）
  getAllKnownItems() {
    const allItems = new Set(this.customItems);
    Object.values(this.characterItems).forEach((list) => {
      list.forEach((item) => allItems.add(item));
    });
    return Array.from(allItems).sort();
  }
}

// 动作配置的通用管理器实例
export const motionManager = new GenericConfigManager(
  "动作",
  "character_motions",
  "bestdori_custom_motions"
);

// 表情配置的通用管理器实例
export const expressionManager = new GenericConfigManager(
  "表情",
  "character_expressions",
  "bestdori_custom_expressions"
);
