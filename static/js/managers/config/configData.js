import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { quoteManager } from "@managers/quoteManager.js";
import { costumeManager } from "@managers/costumeManager.js";
import { FileUtils } from "@utils/FileUtils.js";
import { positionManager } from "@managers/positionManager.js";
import {
  motionManager,
  expressionManager,
} from "@managers/genericConfigManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { apiService } from "@services/ApiService.js";
import { modalService } from "@services/ModalService.js";

// 配置数据层：负责从后端/本地读取配置，以及导入导出与清缓存。
export const configData = {
  // 生成一个带时间戳的文件名（用于导出下载）
  generateFilename(prefix = "file", extension = "json") {
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:-]/g, "");
    return `${prefix}_${timestamp}.${extension}`;
  },

  // 把数字设置写进 localStorage，并同步到页面输入框
  applyNumericSetting(storageKey, inputId, value) {
    if (typeof value !== "number") {
      return;
    }

    const normalizedValue = Math.max(0, value);
    storageService.set(storageKey, normalizedValue);
    const input = document.getElementById(inputId);
    if (input) {
      input.value = normalizedValue;
    }
  },

  // 从后端加载默认配置，并优先使用本地覆盖（如果有）
  async loadConfig(manager) {
    try {
      const data = await apiService.getConfig();
      state.set("configData", data);
      manager.defaultConfig = data.character_mapping;
      state.set("avatarMapping", data.avatar_mapping || {});

      const savedConfig = this.loadLocalConfig();
      if (savedConfig) {
        state.set("currentConfig", savedConfig);
      } else {
        state.set("currentConfig", { ...manager.defaultConfig });
      }

      quoteManager.renderQuoteOptions();
      motionManager.init();
      expressionManager.init();
    } catch (error) {
      console.error("加载配置失败:", error);
      ui.showStatus(error.message || "无法加载应用配置", "error");
    }
  },

  // 从本地读取“角色映射配置”
  loadLocalConfig() {
    return storageService.get(STORAGE_KEYS.CHARACTER_MAPPING);
  },

  // 保存“角色映射配置”到本地
  saveLocalConfig(config) {
    return storageService.set(STORAGE_KEYS.CHARACTER_MAPPING, config);
  },

  // 导出所有配置为一个 JSON 文件（角色/引号/服装/位置/动作表情等）
  async exportConfig(manager) {
    await ui.withButtonLoading(
      "exportConfigBtn",
      async () => {
        const fullConfig = {
          character_mapping: state.get("currentConfig"),
          custom_quotes: state.get("customQuotes"),
          costume_mapping: state.get("currentCostumes"),
          available_costumes: costumeManager
            ? costumeManager.availableCostumes
            : {},
          built_in_characters: costumeManager
            ? Array.from(costumeManager.builtInCharacters)
            : [],
          position_config: {
            autoPositionMode: positionManager
              ? positionManager.autoPositionMode
              : true,
            manualPositions: positionManager
              ? positionManager.manualPositions
              : {},
          },
          custom_motions: motionManager ? motionManager.customItems : [],
          custom_expressions: expressionManager
            ? expressionManager.customItems
            : [],
          custom_quick_fill:
            storageService.get(STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS) || [],
          auto_append_spaces: storageService.get(
            STORAGE_KEYS.AUTO_APPEND_SPACES,
            0,
          ),
          auto_append_spaces_before_newline: storageService.get(
            STORAGE_KEYS.AUTO_APPEND_SPACES_BEFORE_NEWLINE,
            0,
          ),
          export_date: new Date().toISOString(),
          version: "1.4",
        };
        const dataStr = JSON.stringify(fullConfig, null, 2);
        await FileUtils.delay(300);
        FileUtils.downloadAsFile(
          dataStr,
          this.generateFilename("bestdori_config", "json"),
        );
        ui.showStatus("所有配置已导出", "success");
      },
      "导出中...",
    );
  },

  // 简单校验：确认导入文件是个普通对象（避免奇怪的数据结构）
  validateConfig(config) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      console.error("配置验证失败：不是有效的对象");
      return false;
    }
    return true;
  },

  // 导入配置文件（读取 JSON，并分发给各个子系统）
  async importConfig(manager, file) {
    try {
      const text = await FileUtils.readFileAsText(file);
      const config = JSON.parse(text);
      this._applyImportedConfig(config, manager);
      ui.showStatus("配置导入成功", "success");
    } catch (error) {
      console.error("配置导入失败:", error);
      ui.showStatus(`配置文件格式错误: ${error.message}`, "error");
    }
  },

  // 校验并将导入的配置分发给各个子系统
  _applyImportedConfig(config, manager) {
    if (!this.validateConfig(config)) {
      throw new Error("配置文件包含不安全的数据，导入已被阻止");
    }
    if (!config.character_mapping) {
      throw new Error("配置文件中没有有效数据");
    }

    // 角色映射
    state.set("currentConfig", config.character_mapping);
    this.saveLocalConfig(config.character_mapping);

    // 自定义引号
    if (config.custom_quotes && Array.isArray(config.custom_quotes)) {
      state.set("customQuotes", config.custom_quotes);
      quoteManager.saveCustomQuotes();
    }

    // 服装
    if (config.costume_mapping || config.available_costumes) {
      costumeManager.importCostumes(config);
    }

    // 位置
    if (config.position_config) {
      positionManager.importPositions(config.position_config);
    }

    // 动作
    if (config.custom_motions && Array.isArray(config.custom_motions)) {
      motionManager.customItems = [...config.custom_motions];
      motionManager.saveCustomItems();
    }

    // 表情
    if (config.custom_expressions && Array.isArray(config.custom_expressions)) {
      expressionManager.customItems = [...config.custom_expressions];
      expressionManager.saveCustomItems();
    }

    // 快速填充选项
    if (config.custom_quick_fill && Array.isArray(config.custom_quick_fill)) {
      storageService.set(
        STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS,
        config.custom_quick_fill,
      );
    }

    // 刷新 UI
    manager.renderConfigList();
    quoteManager.renderQuoteOptions();

    // 数字设置
    this.applyNumericSetting(
      STORAGE_KEYS.AUTO_APPEND_SPACES,
      "appendSpaces",
      config.auto_append_spaces,
    );
    this.applyNumericSetting(
      STORAGE_KEYS.AUTO_APPEND_SPACES_BEFORE_NEWLINE,
      "appendSpacesBeforeNewline",
      config.auto_append_spaces_before_newline,
    );
  },

  // 清空本地保存的所有数据（相当于恢复出厂设置）
  async clearLocalStorage() {
    const confirmed = await modalService.confirm(
      "【警告】此操作将删除所有本地保存的用户数据，包括：\n\n" +
        "  - 自定义角色映射\n" +
        "  - 所有角色的服装配置\n" +
        "  - 引号选项状态（预设和自定义）\n" +
        "  - 自定义动作和表情\n" +
        "  - 自动添加空格的配置\n" +
        "  - Live2D 布局和位置设置\n" +
        "  - 编辑器偏好设置\n\n" +
        "网页将恢复到初始默认状态。此操作无法撤销，确定要继续吗？",
    );

    if (!confirmed) {
      return;
    }

    await ui.withButtonLoading(
      "clearCacheBtn",
      async () => {
        const keysToRemove = [
          STORAGE_KEYS.CHARACTER_MAPPING,
          STORAGE_KEYS.CUSTOM_QUOTES,
          STORAGE_KEYS.PRESET_QUOTES_STATE,
          STORAGE_KEYS.COSTUME_MAPPING_V2,
          STORAGE_KEYS.AVAILABLE_COSTUMES_V2,
          STORAGE_KEYS.POSITION_CONFIG,
          STORAGE_KEYS.CARD_GROUPING,
          STORAGE_KEYS.PINNED_CHARACTERS,
          STORAGE_KEYS.CUSTOM_MOTIONS,
          STORAGE_KEYS.CUSTOM_EXPRESSIONS,
          STORAGE_KEYS.LIVE2D_SUBSEQUENT_MODE,
          STORAGE_KEYS.SPEAKER_MULTI_SELECT_MODE,
          STORAGE_KEYS.SPEAKER_TEXT_EDIT_MODE,
          STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS,
          STORAGE_KEYS.AUTO_APPEND_SPACES,
          STORAGE_KEYS.AUTO_APPEND_SPACES_BEFORE_NEWLINE,
        ];

        storageService.removeMultiple(keysToRemove);

        await FileUtils.delay(500);
        await modalService.alert("缓存已成功清除！网页即将重新加载。");
        location.reload();
      },
      "清除中...",
    );
  },
};
