// 服装数据管理器（仅保留数据和配置的生命周期逻辑，拆离了渲染界面）
import { state } from "@managers/stateManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { apiService } from "@services/ApiService.js";
import { eventBus } from "@services/EventBus.js";
import { DataUtils } from "@utils/DataUtils.js";
import { costumeView } from "@views/costumeView.js";

export const costumeManager = {
  defaultCostumes: {},
  baseCostumes: {},
  availableCostumes: {},
  builtInCharacters: new Set(),

  tempCostumeChanges: {},
  draftCostumes: {},

  // 初始化接口：供应用入口绑定，转发给渲染模块
  init() {
    costumeView.init(this);
  },

  // 步骤准备：复制状态，渲染界面
  prepareStep() {
    this.tempCostumeChanges = DataUtils.deepClone(state.currentCostumes);
    this.draftCostumes = DataUtils.deepClone(this.availableCostumes);
    costumeView.renderCostumeList(this);
  },

  // 向后端加载服装配置
  async loadConfig() {
    try {
      const costumeResponse = await apiService.fetchJson("/api/costumes");
      this.baseCostumes = costumeResponse.available_costumes;
      this.defaultCostumes = costumeResponse.default_costumes;

      const baseConfigData =
        state.configData || (await apiService.fetchJson("/api/config"));
      this.builtInCharacters = new Set(
        Object.keys(baseConfigData.character_mapping),
      );

      const savedCostumes = storageService.load(
        STORAGE_KEYS.COSTUME_MAPPING_V2,
      );
      state.currentCostumes =
        savedCostumes || this.mapDefaultCostumes();

      const savedCostumeMap = storageService.load(
        STORAGE_KEYS.AVAILABLE_COSTUMES_V2,
      );
      this.availableCostumes =
        savedCostumeMap || this.mapCostumes();
    } catch (error) {
      console.error("加载服装配置失败:", error);
      throw error;
    }
  },

  // 映射内置角色的默认可用服装
  mapCostumes() {
    return Object.fromEntries(
      Object.entries(state.currentConfig).map(
        ([characterName, characterIds]) => {
          const primaryCharacterId = characterIds[0];
          const isBuiltInCharacter = this.builtInCharacters.has(characterName);
          const availableCostumes = isBuiltInCharacter
            ? [...(this.baseCostumes[primaryCharacterId] || [])]
            : [];
          const defaultCostumeId = this.defaultCostumes[primaryCharacterId];

          if (
            isBuiltInCharacter &&
            defaultCostumeId &&
            !availableCostumes.includes(defaultCostumeId)
          ) {
            availableCostumes.push(defaultCostumeId);
          }

          return [characterName, availableCostumes];
        },
      ),
    );
  },

  // 映射初始服装数据
  mapDefaultCostumes() {
    return Object.fromEntries(
      Object.entries(state.currentConfig).map(
        ([characterName, characterIds]) => {
          const primaryCharacterId = characterIds[0];
          if (!this.builtInCharacters.has(characterName)) {
            return [characterName, ""];
          }

          const defaultCostumeId = this.defaultCostumes[primaryCharacterId];
          const availableCostumes =
            this.baseCostumes[primaryCharacterId] || [];
          const selectedCostume =
            defaultCostumeId && availableCostumes.includes(defaultCostumeId)
              ? defaultCostumeId
              : availableCostumes[0] || "";
          return [characterName, selectedCostume];
        },
      ),
    );
  },

  // 外部导入服装配置
  importCostumes(config) {
    if (config.costume_mapping) {
      state.currentCostumes = config.costume_mapping;
      storageService.save(
        STORAGE_KEYS.COSTUME_MAPPING_V2,
        config.costume_mapping,
      );
    }

    if (config.built_in_characters) {
      this.builtInCharacters = new Set(config.built_in_characters);
    }

    if (config.available_costumes) {
      this.availableCostumes = config.available_costumes;
      storageService.save(
        STORAGE_KEYS.AVAILABLE_COSTUMES_V2,
        this.availableCostumes,
      );
      return;
    }

    if (config.costume_mapping) {
      this.availableCostumes = this.mapCostumes();
      storageService.save(
        STORAGE_KEYS.AVAILABLE_COSTUMES_V2,
        this.availableCostumes,
      );
    }
  },

  // 保存服装状态到数据层
  async saveCostumesData() {
    state.currentCostumes = DataUtils.deepClone(this.tempCostumeChanges);
    this.availableCostumes = DataUtils.deepClone(this.draftCostumes);
    storageService.save(
      STORAGE_KEYS.COSTUME_MAPPING_V2,
      state.currentCostumes,
    );
    storageService.save(
      STORAGE_KEYS.AVAILABLE_COSTUMES_V2,
      this.availableCostumes,
    );
  },

  // 获取自定义服装的映射
  collectCustoms() {
    const customCostumes = {};
    const customOptions = {};

    Object.entries(state.currentConfig).forEach(([characterName]) => {
      if (this.builtInCharacters.has(characterName)) {
        return;
      }

      if (this.tempCostumeChanges[characterName] !== undefined) customCostumes[characterName] = this.tempCostumeChanges[characterName];

      if (this.draftCostumes[characterName]) {
        customOptions[characterName] = [
          ...this.draftCostumes[characterName],
        ];
      }
    });

    return {
      customCostumes,
      customOptions,
    };
  },

  // 保证服装容器初始化
  ensureTempCostumes(characterName) {
    if (!Array.isArray(this.draftCostumes[characterName])) this.draftCostumes[characterName] = [];
    return this.draftCostumes[characterName];
  },

  // 更换选中的服装ID
  replaceCostume(characterName, currentCostumeId, nextCostumeId = "") {
    if (this.tempCostumeChanges[characterName] === currentCostumeId) this.tempCostumeChanges[characterName] = nextCostumeId;
  },

  // 配置重置后的服装数据重置逻辑
  syncAfterConfigReset(defaultConfig) {
    const prevSelectedCostumes = { ...state.currentCostumes };
    const prevCostumeMap = { ...this.availableCostumes };

    const nextSelectedCostumes = {};
    const nextCostumes = {};

    Object.entries(defaultConfig).forEach(([characterName, characterIds]) => {
      const primaryCharacterId = characterIds[0];

      if (Object.hasOwn(prevSelectedCostumes, characterName)) {
        nextSelectedCostumes[characterName] = prevSelectedCostumes[characterName];
        nextCostumes[characterName] = prevCostumeMap[characterName] || [];
        return;
      }

      nextSelectedCostumes[characterName] =
        this.defaultCostumes[primaryCharacterId] || "";
      nextCostumes[characterName] =
        this.baseCostumes[primaryCharacterId] || [];
    });

    state.currentCostumes = nextSelectedCostumes;
    this.availableCostumes = nextCostumes;
    storageService.save(STORAGE_KEYS.COSTUME_MAPPING_V2, nextSelectedCostumes);
    storageService.save(STORAGE_KEYS.AVAILABLE_COSTUMES_V2, this.availableCostumes);
  },
};

// 配置重置事件订阅
eventBus.on("config:reset", ({ defaultConfig }) => {
  costumeManager.syncAfterConfigReset(defaultConfig);
});

// 配置导入事件订阅
eventBus.on("config:imported", ({ config }) => {
  if (config.costume_mapping || config.available_costumes) {
    costumeManager.importCostumes(config);
  }
});

// 导出时的数据收集订阅
eventBus.on("config:collectExportData", (exportParts) => {
  exportParts.costumeMapping = state.currentCostumes;
  exportParts.availableCostumes = costumeManager.availableCostumes;
  exportParts.builtInCharacters = Array.from(costumeManager.builtInCharacters);
});
