import { storageService, STORAGE_KEYS } from "@services/StorageService.js";

/**
 * 位置配置的存取与计算逻辑。
 */
export const positionStore = {
  loadPositionConfig(manager) {
    const config = storageService.get(STORAGE_KEYS.POSITION_CONFIG);
    if (config) {
      manager.autoPositionMode = config.autoPositionMode !== false;
      manager.manualPositions = config.manualPositions || {};
    }
  },

  savePositionConfig(manager) {
    const config = {
      autoPositionMode: manager.autoPositionMode,
      manualPositions: manager.manualPositions,
    };
    return storageService.set(STORAGE_KEYS.POSITION_CONFIG, config);
  },

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
