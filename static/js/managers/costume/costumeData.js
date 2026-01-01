import { state } from "@managers/stateManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { apiService } from "@services/ApiService.js";
import { ui } from "@utils/uiUtils.js";

// 服装数据的仓库：负责转换数据结构/读写本地/从后端加载
export const costumeData = {
  // 把“可用服装(按角色ID)”转换成“可用服装(按角色名 key)”
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

  // 把“默认服装(按角色ID)”转换成“默认服装(按角色名 key)”
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

  // 从后端加载默认服装配置，并结合本地保存的数据初始化 manager
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

  // 从本地读取“当前服装选择”
  loadLocalCostumes() {
    return storageService.get(STORAGE_KEYS.COSTUME_MAPPING_V2);
  },

  // 保存“当前服装选择”到本地
  saveLocalCostumes(costumes) {
    return storageService.set(STORAGE_KEYS.COSTUME_MAPPING_V2, costumes);
  },

  // 从本地读取“可用服装列表”
  loadLocalAvailableCostumes() {
    return storageService.get(STORAGE_KEYS.AVAILABLE_COSTUMES_V2);
  },

  // 保存“可用服装列表”（会做一个简单校验，避免写入空数据）
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

  // 导入配置：应用导入的服装相关字段，并保存到本地
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
