import { storageService, STORAGE_KEYS } from "@services/StorageService.js";

// 位置配置的仓库：负责读写本地存储，并计算“自动站位”时的位置分配
export const positionStore = {
  // 从本地读取位置配置，并写回 manager
  loadPositionConfig(manager) {
    const config = storageService.get(STORAGE_KEYS.POSITION_CONFIG);
    if (config) {
      manager.autoPositionMode = config.autoPositionMode !== false;
      manager.manualPositions = config.manualPositions || {};
    }
  },

  // 把 manager 里的位置配置保存到本地
  savePositionConfig(manager) {
    const config = {
      autoPositionMode: manager.autoPositionMode,
      manualPositions: manager.manualPositions,
    };
    return storageService.set(STORAGE_KEYS.POSITION_CONFIG, config);
  },

  // 导入位置配置（并立刻保存）
  importPositions(manager, positionConfig) {
    if (!positionConfig) return;
    if (typeof positionConfig.autoPositionMode === "boolean") {
      manager.autoPositionMode = positionConfig.autoPositionMode;
    }
    if (positionConfig.manualPositions) {
      manager.manualPositions = positionConfig.manualPositions;
    }
    this.savePositionConfig(manager);
  },

  // 获取某角色的站位：自动模式按顺序分配；手动模式读手动配置
  getCharacterPositionConfig(manager, characterName, appearanceOrder) {
    if (manager.autoPositionMode) {
      return {
        position:
          manager.autoLayoutPositions[
            appearanceOrder % manager.autoLayoutPositions.length
          ],
        offset: 0,
      };
    } else {
      const config = manager.manualPositions[characterName] || {
        position: "center",
        offset: 0,
      };
      return {
        position: config.position || "center",
        offset: config.offset || 0,
      };
    }
  },
};
