// 位置数据管理器（仅保留配置数据存储与计算逻辑，拆离了渲染层）
import { DataUtils } from "@utils/DataUtils.js";
import { state } from "@managers/stateManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { eventBus } from "@services/EventBus.js";
import { positionView } from "@views/positionView.js";

export const positionManager = {
  autoLayoutPositions: ["leftInside", "center", "rightInside"],

  positionNames: {
    leftOver: "左外",
    leftInside: "左内",
    center: "中间",
    rightInside: "右内",
    rightOver: "右外",
  },

  manualPositions: {},
  tempManualPositions: {},
  tempAutoPositionMode: true,
  autoPositionMode: true,

  // 初始化：加载配置并转发给渲染模块进行事件监听和页面配置绑定
  init() {
    this.loadPositionConfig();
    positionView.init(this);
  },

  // 步骤准备：克隆临时数据并命令渲染模块重画界面
  prepareStep() {
    this.tempAutoPositionMode = this.autoPositionMode;
    this.tempManualPositions = DataUtils.deepClone(this.manualPositions);
    positionView.renderPositionList();
    positionView.toggleManualConfig();
  },

  // 保存数据
  async savePositionsData() {
    this.autoPositionMode = this.tempAutoPositionMode;
    this.manualPositions = DataUtils.deepClone(this.tempManualPositions);
    this.savePositionConfig();
  },

  // 从本地缓存载入位置设置
  loadPositionConfig() {
    const config = storageService.load(STORAGE_KEYS.POSITION_CONFIG);
    if (!config) {
      return;
    }

    this.autoPositionMode = config.autoPositionMode !== false;
    this.manualPositions = config.manualPositions || {};
  },

  // 将位置设置序列化写入本地缓存
  savePositionConfig() {
    const config = {
      autoPositionMode: this.autoPositionMode,
      manualPositions: this.manualPositions,
    };
    return storageService.save(STORAGE_KEYS.POSITION_CONFIG, config);
  },

  // 外部导入位置配置数据
  importPositions(positionConfig) {
    if (!positionConfig) {
      return;
    }

    if (typeof positionConfig.autoPositionMode === "boolean") {
      this.autoPositionMode = positionConfig.autoPositionMode;
    }
    if (positionConfig.manualPositions) {
      this.manualPositions = positionConfig.manualPositions;
    }

    this.savePositionConfig();
  },

  // 获取对应发言角色首次登场布局的计算位置与偏移
  findPositionConfig(characterName, appearanceOrder) {
    if (this.autoPositionMode) {
      return {
        position:
          this.autoLayoutPositions[
            appearanceOrder % this.autoLayoutPositions.length
          ],
        offset: 0,
      };
    }

    const config = this.manualPositions[characterName] || {
      position: "center",
      offset: 0,
    };
    return {
      position: config.position || "center",
      offset: config.offset || 0,
    };
  },
};

// 配置导入事件订阅
eventBus.on("config:imported", ({ config }) => {
  if (config.position_config) {
    positionManager.importPositions(config.position_config);
  }
});

// 导出时的数据收集订阅
eventBus.on("config:collectExportData", (exportParts) => {
  exportParts.autoPositionMode = positionManager.autoPositionMode;
  exportParts.manualPositions = positionManager.manualPositions;
});
