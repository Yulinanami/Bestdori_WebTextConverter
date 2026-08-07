// 角色配置数据管理器（仅保留数据和配置生命周期逻辑，拆离了渲染层）
import { state } from "@managers/stateManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { apiService } from "@services/ApiService.js";
import { eventBus } from "@services/EventBus.js";
import { configView } from "@views/configView.js";
import { converterView } from "@views/converterView.js";
import { ui } from "@utils/uiUtils.js";

const CLEAR_KEYS = [
  STORAGE_KEYS.CHARACTER_MAPPING, STORAGE_KEYS.CUSTOM_QUOTES, STORAGE_KEYS.PRESET_QUOTES_STATE,
  STORAGE_KEYS.COSTUME_MAPPING_V2, STORAGE_KEYS.AVAILABLE_COSTUMES_V2, STORAGE_KEYS.POSITION_CONFIG,
  STORAGE_KEYS.CARD_GROUPING, STORAGE_KEYS.PINNED_CHARACTERS, STORAGE_KEYS.CUSTOM_MOTIONS,
  STORAGE_KEYS.CUSTOM_EXPRESSIONS, STORAGE_KEYS.LIVE2D_SUBSEQUENT_MODE,
  STORAGE_KEYS.SPEAKER_MULTI_SELECT_MODE, STORAGE_KEYS.SPEAKER_TEXT_EDIT_MODE,
  STORAGE_KEYS.SPEAKER_SORT_MODE,
  STORAGE_KEYS.SPEAKER_DRAG_OPTIMIZATION,
  STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS, STORAGE_KEYS.AUTO_APPEND_SPACES,
  STORAGE_KEYS.AUTO_APPEND_SPACES_BEFORE_NEWLINE,
];

export const configManager = {
  defaultConfig: null,

  // 初始化配置：转发给配置渲染视图层绑定
  init() {
    configView.init(this);
  },

  // 解析角色 id
  parseCharacterIds(characterIdsText) {
    if (!characterIdsText) return [];
    return characterIdsText
      .split(",")
      .map((idText) => parseInt(idText.trim(), 10))
      .filter((id) => !Number.isNaN(id));
  },

  // 加载配置数据
  async loadConfig() {
    try {
      const data = await apiService.fetchJson("/api/config");
      state.configData = data;
      state.avatarMapping = data.avatar_mapping || {};
      this.defaultConfig = data.character_mapping;

      const savedConfig = storageService.load(STORAGE_KEYS.CHARACTER_MAPPING);
      state.currentConfig = savedConfig || { ...this.defaultConfig };

      eventBus.emit("config:loaded", { configData: data });
      configView.renderConfigList();
    } catch (error) {
      console.error("加载配置失败:", error);
    }
  },

  // 保存数据
  async saveConfigData(newConfig) {
    if (!storageService.save(STORAGE_KEYS.CHARACTER_MAPPING, newConfig)) {
      throw new Error("配置保存失败，可能是存储空间不足");
    }
    state.currentConfig = newConfig;
    configView.renderConfigList();
  },

  // 恢复默认配置数据
  async resetConfigData() {
    storageService.remove(STORAGE_KEYS.CHARACTER_MAPPING);
    state.currentConfig = { ...this.defaultConfig };
    storageService.remove(STORAGE_KEYS.CUSTOM_QUOTES);
    state.customQuotes = [];

    configView.renderConfigList();

    // 通知其他模块配置已重置
    eventBus.emit("config:reset", {
      defaultConfig: this.defaultConfig,
    });
  },

  // 按角色 id 找角色名
  findCharName(characterId) {
    for (const [characterName, characterIds] of Object.entries(
      state.currentConfig || {}
    )) {
      if (characterIds.includes(characterId)) {
        return characterName;
      }
    }
    return null;
  },

  // 写入一个数字设置
  applyNumericSetting(storageKey, inputId, value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    const normalizedValue = converterView.normalizeSpaceCount(value);
    storageService.save(storageKey, normalizedValue);
    converterView.updateNumericInput(inputId, normalizedValue);
  },

  // 导出整份本地配置数据
  async exportConfig() {
    const exportParts = {};
    eventBus.emit("config:collectExportData", exportParts);

    const exportResult = await apiService.exportConfigFile({
      characterMapping: state.currentConfig,
      customQuotes: state.customQuotes,
      costumeMapping: exportParts.costumeMapping,
      availableCostumes: exportParts.availableCostumes,
      builtInCharacters: exportParts.builtInCharacters,
      autoPositionMode: exportParts.autoPositionMode,
      manualPositions: exportParts.manualPositions,
      customMotions: exportParts.customMotions,
      customExpressions: exportParts.customExpressions,
      customQuickFill:
        storageService.load(STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS) || [],
      autoAppendSpaces: storageService.load(
        STORAGE_KEYS.AUTO_APPEND_SPACES,
        0,
      ),
      autoAppendSpacesBeforeNewline: storageService.load(
        STORAGE_KEYS.AUTO_APPEND_SPACES_BEFORE_NEWLINE,
        0,
      ),
    });

    const downloadBlob = await apiService.downloadResult(
      exportResult.content,
      exportResult.filename,
    );

    const { FileUtils } = await import("@utils/FileUtils.js");
    FileUtils.downloadAsFile(downloadBlob, exportResult.filename);
  },

  // 读取并导入配置文件
  async importConfig(file) {
    try {
      const response = await apiService.importConfigFile(file);
      this.applyImportedConfig(response.config);
      ui.showStatus("配置导入成功！", "success");
    } catch (error) {
      console.error("配置导入失败:", error);
      ui.showStatus(`配置导入失败: ${error.message}`, "error");
    }
  },

  // 把导入结果写回页面和本地存储
  applyImportedConfig(config) {
    state.currentConfig = config.character_mapping;
    storageService.save(
      STORAGE_KEYS.CHARACTER_MAPPING,
      config.character_mapping,
    );

    // 通知其他模块处理各自的导入数据
    eventBus.emit("config:imported", { config });

    if (Array.isArray(config.custom_quick_fill)) {
      storageService.save(
        STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS,
        config.custom_quick_fill,
      );
    }

    configView.renderConfigList();
    // 只有导入文件里带了数字设置时才回写输入框
    [
      [STORAGE_KEYS.AUTO_APPEND_SPACES, "appendSpaces", config.auto_append_spaces],
      [
        STORAGE_KEYS.AUTO_APPEND_SPACES_BEFORE_NEWLINE,
        "appendSpacesBeforeNewline",
        config.auto_append_spaces_before_newline,
      ],
    ].forEach(([storageKey, inputId, value]) =>
      this.applyNumericSetting(storageKey, inputId, value),
    );
  },

  // 清空所有缓存数据
  async clearAllCache() {
    storageService.removeMultiple(CLEAR_KEYS);
    location.reload();
  },
};
