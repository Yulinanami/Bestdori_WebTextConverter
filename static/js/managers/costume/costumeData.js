import { state } from "@managers/stateManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { apiService } from "@services/ApiService.js";
import { ui } from "@utils/uiUtils.js";

// 服装数据的仓库：负责转换数据结构/读写本地/从后端加载
export const costumeData = {
  // 把“可用服装(按角色ID)”转换成“可用服装(按角色名)”
  convertAvailableCostumesToNameBased(manager) {
    const availableCostumesByName = {};
    Object.entries(state.get("currentConfig")).forEach(
      ([characterName, characterIds]) => {
        if (characterIds && characterIds.length > 0) {
          const primaryCharacterId = characterIds[0];

          const isCustomCharacter =
            !manager.builtInCharacters ||
            !manager.builtInCharacters.has(characterName);

          if (isCustomCharacter) {
            availableCostumesByName[characterName] = [];
          } else if (manager.defaultAvailableCostumes[primaryCharacterId]) {
            availableCostumesByName[characterName] = [
              ...manager.defaultAvailableCostumes[primaryCharacterId],
            ];
          } else {
            availableCostumesByName[characterName] = [];
          }

          if (!isCustomCharacter) {
            const defaultCostumeId =
              manager.defaultCostumes[primaryCharacterId];

            if (
              defaultCostumeId &&
              !availableCostumesByName[characterName].includes(defaultCostumeId)
            ) {
              availableCostumesByName[characterName].push(defaultCostumeId);
            }
          }
        }
      },
    );

    return availableCostumesByName;
  },

  // 把“默认服装(按角色ID)”转换成“默认服装(按角色名)”
  convertDefaultCostumesToNameBased(manager) {
    const defaultCostumesByName = {};
    Object.entries(state.get("currentConfig")).forEach(
      ([characterName, characterIds]) => {
        if (characterIds && characterIds.length > 0) {
          const primaryCharacterId = characterIds[0];

          const isCustomCharacter =
            !manager.builtInCharacters ||
            !manager.builtInCharacters.has(characterName);

          if (isCustomCharacter) {
            defaultCostumesByName[characterName] = "";
          } else {
            const defaultCostumeId = manager.defaultCostumes[primaryCharacterId];

            if (defaultCostumeId) {
              const availableCostumes =
                manager.defaultAvailableCostumes[primaryCharacterId] || [];
              if (availableCostumes.includes(defaultCostumeId)) {
                defaultCostumesByName[characterName] = defaultCostumeId;
              } else {
                defaultCostumesByName[characterName] =
                  availableCostumes[0] || "";
              }
            } else {
              defaultCostumesByName[characterName] = "";
            }
          }
        }
      },
    );

    return defaultCostumesByName;
  },

  // 从后端加载默认服装配置，并结合本地保存的数据初始化 manager
  async loadCostumeConfig(manager) {
    try {
      const costumeConfigResponse = await apiService.getCostumes();
      manager.defaultAvailableCostumes = costumeConfigResponse.available_costumes;
      manager.defaultCostumes = costumeConfigResponse.default_costumes;

      const baseConfigData =
        state.get("configData") || (await apiService.getConfig());
      manager.builtInCharacters = new Set(
        Object.keys(baseConfigData.character_mapping)
      );

      const savedSelectedCostumes = this.loadLocalCostumes();
      if (savedSelectedCostumes) {
        state.set("currentCostumes", savedSelectedCostumes);
      } else {
        state.set(
          "currentCostumes",
          this.convertDefaultCostumesToNameBased(manager)
        );
      }

      const savedAvailableCostumeMap = this.loadLocalAvailableCostumes();
      if (savedAvailableCostumeMap) {
        manager.availableCostumes = savedAvailableCostumeMap;
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
      Object.values(manager.availableCostumes).some((costumeList) =>
        Array.isArray(costumeList)
      );

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
