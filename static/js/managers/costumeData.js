import { state } from "./stateManager.js";
import { storageService, STORAGE_KEYS } from "../services/StorageService.js";
import { apiService } from "../services/ApiService.js";
import { ui } from "../utils/uiUtils.js";

/**
 * 服装相关的数据与持久化逻辑。
 * 提供独立的转换、加载、保存方法，方便在其他模块复用。
 */
export const costumeData = {
  // 转换可用服装列表为基于角色名称的映射
  convertAvailableCostumesToNameBased(manager) {
    const nameBased = {};
    Object.entries(state.get("currentConfig")).forEach(([name, ids]) => {
      if (ids && ids.length > 0) {
        const primaryId = ids[0];
        const characterKey = manager.getCharacterKey(name);

        const isCustomCharacter =
          !manager.builtInCharacters || !manager.builtInCharacters.has(name);

        if (isCustomCharacter) {
          nameBased[characterKey] = [];
        } else if (manager.defaultAvailableCostumes[primaryId]) {
          nameBased[characterKey] = [
            ...manager.defaultAvailableCostumes[primaryId],
          ];
        } else {
          nameBased[characterKey] = [];
        }

        if (!isCustomCharacter) {
          const defaultCostume = manager.defaultCostumes[primaryId];

          if (
            defaultCostume &&
            !nameBased[characterKey].includes(defaultCostume)
          ) {
            nameBased[characterKey].push(defaultCostume);
          }
        }
      }
    });

    return nameBased;
  },

  // 转换默认服装配置为基于角色名称的映射
  convertDefaultCostumesToNameBased(manager) {
    const nameBased = {};
    Object.entries(state.get("currentConfig")).forEach(([name, ids]) => {
      if (ids && ids.length > 0) {
        const primaryId = ids[0];
        const characterKey = manager.getCharacterKey(name);

        const isCustomCharacter =
          !manager.builtInCharacters || !manager.builtInCharacters.has(name);

        if (isCustomCharacter) {
          nameBased[characterKey] = "";
        } else {
          const defaultCostume = manager.defaultCostumes[primaryId];

          if (defaultCostume) {
            const availableList =
              manager.defaultAvailableCostumes[primaryId] || [];
            if (availableList.includes(defaultCostume)) {
              nameBased[characterKey] = defaultCostume;
            } else {
              nameBased[characterKey] = availableList[0] || "";
            }
          } else {
            nameBased[characterKey] = "";
          }
        }
      }
    });

    return nameBased;
  },

  // 加载服装配置
  async loadCostumeConfig(manager) {
    try {
      const costumeDataResponse = await apiService.getCostumes();
      manager.defaultAvailableCostumes = costumeDataResponse.available_costumes;
      manager.defaultCostumes = costumeDataResponse.default_costumes;

      const configData =
        state.get("configData") || (await apiService.getConfig());
      manager.builtInCharacters = new Set(
        Object.keys(configData.character_mapping)
      );

      const savedCostumes = this.loadLocalCostumes();
      if (savedCostumes) {
        state.set("currentCostumes", savedCostumes);
      } else {
        state.set(
          "currentCostumes",
          this.convertDefaultCostumesToNameBased(manager)
        );
      }

      const savedAvailableCostumes = this.loadLocalAvailableCostumes();
      if (savedAvailableCostumes) {
        manager.availableCostumes = savedAvailableCostumes;
      } else {
        manager.availableCostumes =
          this.convertAvailableCostumesToNameBased(manager);
      }
    } catch (error) {
      console.error("加载服装配置失败:", error);
      ui.showStatus(error.message || "无法加载服装配置", "error");
    }
  },

  // 从 LocalStorage 加载服装配置
  loadLocalCostumes() {
    return storageService.get(STORAGE_KEYS.COSTUME_MAPPING_V2);
  },

  // 保存服装配置到 LocalStorage
  saveLocalCostumes(costumes) {
    return storageService.set(STORAGE_KEYS.COSTUME_MAPPING_V2, costumes);
  },

  // 加载本地可用服装列表
  loadLocalAvailableCostumes() {
    return storageService.get(STORAGE_KEYS.AVAILABLE_COSTUMES_V2);
  },

  // 修改保存可用服装列表的方法，添加验证
  saveLocalAvailableCostumes(manager) {
    const hasValidData =
      Object.keys(manager.availableCostumes).length > 0 &&
      Object.values(manager.availableCostumes).some((list) => Array.isArray(list));

    if (!hasValidData) {
      console.warn("尝试保存空的可用服装列表，操作已取消");
      return false;
    }

    return storageService.set(
      STORAGE_KEYS.AVAILABLE_COSTUMES_V2,
      manager.availableCostumes
    );
  },

  // 导入配置时处理服装配置
  importCostumes(manager, config) {
    if (config.costume_mapping) {
      state.set("currentCostumes", config.costume_mapping);
      this.saveLocalCostumes(config.costume_mapping);
    }

    if (config.built_in_characters) {
      manager.builtInCharacters = new Set(config.built_in_characters);
    }

    if (config.available_costumes) {
      manager.availableCostumes = config.available_costumes;
      this.saveLocalAvailableCostumes(manager);
    } else if (config.costume_mapping && !config.available_costumes) {
      manager.availableCostumes =
        this.convertAvailableCostumesToNameBased(manager);
      this.saveLocalAvailableCostumes(manager);
    }
  },
};
