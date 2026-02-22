import { storageService, STORAGE_KEYS } from "@services/StorageService.js";

// 位置配置的仓库：负责读写本地存储，并计算“自动站位”时的位置分配
export const positionStore = {
  // 从本地读取位置配置，并写回 positionManager
  loadPositionConfig(positionManager) {
    const config = storageService.get(STORAGE_KEYS.POSITION_CONFIG);
    if (config) {
      positionManager.autoPositionMode = config.autoPositionMode !== false;
      positionManager.manualPositions = config.manualPositions || {};
    }
  },

  // 把 positionManager 里的位置配置保存到本地
  savePositionConfig(positionManager) {
    const config = {
      autoPositionMode: positionManager.autoPositionMode,
      manualPositions: positionManager.manualPositions,
    };
    return storageService.set(STORAGE_KEYS.POSITION_CONFIG, config);
  },

  // 导入位置配置（并立刻保存）
  importPositions(positionManager, positionConfig) {
    if (!positionConfig) return;
    if (typeof positionConfig.autoPositionMode === "boolean") {
      positionManager.autoPositionMode = positionConfig.autoPositionMode;
    }
    if (positionConfig.manualPositions) {
      positionManager.manualPositions = positionConfig.manualPositions;
    }
    this.savePositionConfig(positionManager);
  },

  // 获取某角色的站位：自动模式按顺序分配；手动模式读手动配置
  getCharacterPositionConfig(positionManager, characterName, appearanceOrder) {
    if (positionManager.autoPositionMode) {
      return {
        position:
          positionManager.autoLayoutPositions[
            appearanceOrder % positionManager.autoLayoutPositions.length
          ],
        offset: 0,
      };
    } else {
      const config = positionManager.manualPositions[characterName] || {
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
