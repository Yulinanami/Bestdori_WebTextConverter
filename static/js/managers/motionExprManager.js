// 动作和表情配置数据管理器（仅保留配置数据存储与计算逻辑，拆离了渲染层）
import { DataUtils } from "@utils/DataUtils.js";
import { state } from "@managers/stateManager.js";
import { eventBus } from "@services/EventBus.js";
import { motionExprView } from "@views/motionExprView.js";

class ItemConfig {
  // 动作或表情特定类别数据的实例化管理
  constructor(name, configKey, storeKey) {
    this.name = name;
    this.configKey = configKey;
    this.storeKey = storeKey;
    this.characterItems = {};
    this.customItems = this.loadCustomItems();
  }

  // 加载初始默认数据
  init() {
    const configData = state.configData;
    if (configData && configData[this.configKey]) {
      this.characterItems = configData[this.configKey];
      return;
    }
    console.warn(`配置中未找到 ${this.configKey}。`);
  }

  // 加载本地自定义缓存数据
  loadCustomItems() {
    try {
      const saved = localStorage.getItem(this.storeKey);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error(`加载自定义 ${this.name} 失败:`, error);
      return [];
    }
  }

  // 写入本地自定义缓存数据
  saveCustomItems() {
    try {
      localStorage.setItem(
        this.storeKey,
        JSON.stringify(this.customItems),
      );
    } catch (error) {
      console.error(`保存自定义 ${this.name} 失败`, error);
    }
  }

  // 收集所有的默认动作/表情项
  listDefaultItems() {
    const defaultItems = new Set();
    Object.values(this.characterItems).forEach((itemList) => {
      itemList.forEach((itemId) => defaultItems.add(itemId));
    });
    return defaultItems;
  }

  // 收集某一角色可用的动作/表情项
  listCharacterItems(characterId) {
    const defaultItems = this.characterItems[characterId] || [];
    return Array.from(new Set([...defaultItems, ...this.customItems])).sort();
  }

  // 收集所有已知的动作/表情项列表
  listKnownItems() {
    const allItems = new Set(this.customItems);
    Object.values(this.characterItems).forEach((itemList) => {
      itemList.forEach((itemId) => allItems.add(itemId));
    });
    return Array.from(allItems).sort();
  }
}

export const motionManager = new ItemConfig(
  "动作",
  "character_motions",
  "bestdori_custom_motions",
);

export const expressionManager = new ItemConfig(
  "表情",
  "character_expressions",
  "bestdori_custom_expressions",
);

export const motionExprManager = {
  tempMotions: [],
  tempExpressions: [],

  // 初始化：中转给界面渲染视图模块绑定事件
  init() {
    motionExprView.init(this);
  },

  // 准备临时数据并触发界面渲染
  prepareStep() {
    this.tempMotions = DataUtils.deepClone(motionManager.customItems);
    this.tempExpressions = DataUtils.deepClone(
      expressionManager.customItems,
    );
    motionExprView.renderLists();
  },

  // 数据保存
  saveData() {
    motionManager.customItems = [...this.tempMotions];
    expressionManager.customItems = [...this.tempExpressions];
    motionManager.saveCustomItems();
    expressionManager.saveCustomItems();
  },
};

// 配置加载完毕订阅：触发配置项的初始化
eventBus.on("config:loaded", () => {
  motionManager.init();
  expressionManager.init();
});

// 外部导入动作表情数据订阅：更新并持久化
eventBus.on("config:imported", ({ config }) => {
  [["custom_motions", motionManager], ["custom_expressions", expressionManager]]
    .forEach(([configKey, manager]) => {
      if (!Array.isArray(config[configKey])) return;
      manager.customItems = [...config[configKey]];
      manager.saveCustomItems();
    });
});

// 导出时的数据收集订阅：合并提供给导出逻辑
eventBus.on("config:collectExportData", (exportParts) => {
  exportParts.customMotions = motionManager.customItems;
  exportParts.customExpressions = expressionManager.customItems;
});
