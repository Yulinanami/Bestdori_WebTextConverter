// 角色配置
import { DataUtils } from "@utils/DataUtils.js";
import { renderAvatar } from "@utils/avatarUtils.js";
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { quoteManager } from "@managers/quoteManager.js";
import { costumeManager } from "@managers/costumeManager.js";
import { positionManager } from "@managers/positionManager.js";
import { motionManager, expressionManager } from "@managers/motionExprManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { modalService } from "@services/ModalService.js";
import { apiService } from "@services/ApiService.js";
import { FileUtils } from "@utils/FileUtils.js";

const CLEAR_KEYS = [
  STORAGE_KEYS.CHARACTER_MAPPING, STORAGE_KEYS.CUSTOM_QUOTES, STORAGE_KEYS.PRESET_QUOTES_STATE,
  STORAGE_KEYS.COSTUME_MAPPING_V2, STORAGE_KEYS.AVAILABLE_COSTUMES_V2, STORAGE_KEYS.POSITION_CONFIG,
  STORAGE_KEYS.CARD_GROUPING, STORAGE_KEYS.PINNED_CHARACTERS, STORAGE_KEYS.CUSTOM_MOTIONS,
  STORAGE_KEYS.CUSTOM_EXPRESSIONS, STORAGE_KEYS.LIVE2D_SUBSEQUENT_MODE,
  STORAGE_KEYS.SPEAKER_MULTI_SELECT_MODE, STORAGE_KEYS.SPEAKER_TEXT_EDIT_MODE,
  STORAGE_KEYS.SPEAKER_DRAG_OPTIMIZATION,
  STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS, STORAGE_KEYS.AUTO_APPEND_SPACES,
  STORAGE_KEYS.AUTO_APPEND_SPACES_BEFORE_NEWLINE,
];

export const configManager = {
  defaultConfig: null,

  // 初始化配置页
  init() {
    this.bindConfigListEvents();
    this.bindActionButtons();
  },

  // 绑定配置列表里的事件
  bindConfigListEvents() {
    const configList = document.getElementById("configList");

    // 点删除按钮时删掉一项
    configList.addEventListener("click", (clickEvent) => {
      const removeButton = clickEvent.target.closest(".remove-btn");
      if (removeButton) {
        removeButton.closest(".config-item").remove();
      }
    });

    // 输入变化时刷新头像
    configList.addEventListener("input", (inputEvent) => {
      const configItem = inputEvent.target.closest(".config-item");
      if (!configItem) {
        return;
      }
      this.updateConfigAvatar(configItem);
    });
  },

  // 绑定页面按钮
  bindActionButtons() {
    [["addConfigBtn", () => this.addConfigItem()], ["saveConfigBtn", () => this.saveConfig()],
      ["resetConfigBtn", () => this.resetConfig()], ["exportConfigBtn", () => this.exportConfig()],
      ["clearCacheBtn", () => this.clearLocalStorage()]].forEach(([buttonId, handler]) => {
      document.getElementById(buttonId).addEventListener("click", handler);
    });

    const importInput = document.getElementById("importConfigInput");
    // 点导入按钮时打开文件选择
    document
      .getElementById("importConfigBtn")
      .addEventListener("click", () => importInput.click());
    // 选中文件后开始导入
    importInput.addEventListener("change", (changeEvent) => {
      const file = changeEvent.target.files[0];
      if (!file) {
        return;
      }
      this.importConfig(file);
      changeEvent.target.value = "";
    });
  },

// 渲染角色列表
  renderConfigList() {
    const configList = document.getElementById("configList");
    // 按每组的第一个角色 id 排序 让列表顺序稳定
    const sortedEntries = DataUtils.sortBy(
      Object.entries(state.currentConfig),
      ([, ids]) => ids?.[0] ?? Number.POSITIVE_INFINITY,
      "asc",
    );
    configList.replaceChildren(
      ...sortedEntries.map(([name, ids]) =>
        this.createConfigItem(name, ids),
      ),
    );
  },

  // 新增一项空配置
  addConfigItem() {
    const configList = document.getElementById("configList");
    configList.prepend(this.createConfigItem());
  },

  // 创建一项角色配置
  createConfigItem(characterName = "", characterIds = []) {
    const template = document.getElementById("config-item-template");
    const clone = template.content.cloneNode(true);
    const configItem = clone.querySelector(".config-item");
    configItem.querySelector(".config-name").value = characterName;
    configItem.querySelector(".config-ids").value = characterIds.join(",");
    this.updateConfigAvatar(configItem);
    return configItem;
  },

  // 解析角色 id
  parseCharacterIds(characterIdsText) {
    return characterIdsText
      .split(",")
      .map((idText) => parseInt(idText.trim(), 10))
      .filter((id) => !Number.isNaN(id));
  },

  // 刷新一项里的头像
  updateConfigAvatar(configItem) {
    const avatarWrapper = configItem.querySelector(".config-avatar-wrapper");
    const characterName = configItem.querySelector(".config-name").value || "?";
    const characterIds = this.parseCharacterIds(
      configItem.querySelector(".config-ids").value,
    );
    const primaryId = characterIds[0] || 0;

    renderAvatar(avatarWrapper, primaryId, characterName);
    const avatar = avatarWrapper.querySelector(".config-avatar");
    if (avatar.classList.contains("fallback")) {
      avatar.textContent = characterName.charAt(0) || "?";
    }
  },

  // 读取页面上的配置
  collectConfigList() {
    const nextConfig = {};
    document.querySelectorAll(".config-item").forEach((configItem) => {
      const characterName = configItem.querySelector(".config-name").value.trim();
      const characterIdsText = configItem.querySelector(".config-ids").value.trim();
      if (!characterName || !characterIdsText) {
        return;
      }

      const characterIds = this.parseCharacterIds(characterIdsText);
      if (characterIds.length > 0) {
        nextConfig[characterName] = characterIds;
      }
    });
    return nextConfig;
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

      quoteManager.renderQuoteOptions();
      motionManager.init();
      expressionManager.init();
    } catch (error) {
      console.error("加载配置失败:", error);
      ui.showStatus(error.message || "无法加载应用配置", "error");
    }
  },

  // 保存配置
  async saveConfig() {
    await ui.withButtonLoading(
      "saveConfigBtn",
      async () => {
        const newConfig = this.collectConfigList();

        await FileUtils.delay(500);
        if (!storageService.save(STORAGE_KEYS.CHARACTER_MAPPING, newConfig)) {
          ui.showStatus("配置保存失败，可能是存储空间不足", "error");
          return;
        }

        state.currentConfig = newConfig;
        ui.showStatus("配置已保存到本地！", "success");
      },
      "保存中...",
    );
  },

  // 恢复默认配置
  async resetConfig() {
    const confirmed = await modalService.confirm(
      "【警告】此操作将恢复为系统默认角色列表。\n\n所有自定义添加的角色及其服装配置都将被删除。\n\n确定要继续吗？",
    );
    if (!confirmed) {
      return;
    }

    await ui.withButtonLoading(
      "resetConfigBtn",
      async () => {
        const prevSelectedCostumes = { ...state.currentCostumes };
        const prevCostumeMap = {
          ...costumeManager.availableCostumes,
        };

        storageService.remove(STORAGE_KEYS.CHARACTER_MAPPING);
        state.currentConfig = { ...this.defaultConfig };
        storageService.remove(STORAGE_KEYS.CUSTOM_QUOTES);
        state.customQuotes = [];

        await this.syncCostumes(
          prevSelectedCostumes,
          prevCostumeMap,
        );

        await FileUtils.delay(300);
        this.renderConfigList();
        quoteManager.renderQuoteOptions();
        ui.showStatus("已恢复默认角色配置（服装配置已保留）", "success");
      },
      "重置中...",
    );
  },

  // 重置配置后同步更新服装
  async syncCostumes(
    prevSelectedCostumes,
    prevCostumeMap,
  ) {
    const nextSelectedCostumes = {};
    const nextCostumes = {};

    // 默认角色重置后 旧服装配置里还能对上的部分继续保留
    Object.entries(this.defaultConfig).forEach(([characterName, characterIds]) => {
      const primaryCharacterId = characterIds[0];

      if (Object.hasOwn(prevSelectedCostumes, characterName)) {
        nextSelectedCostumes[characterName] =
          prevSelectedCostumes[characterName];
        nextCostumes[characterName] =
          prevCostumeMap[characterName] || [];
        return;
      }

      nextSelectedCostumes[characterName] =
        costumeManager.defaultCostumes[primaryCharacterId] || "";
      nextCostumes[characterName] =
        costumeManager.baseCostumes[primaryCharacterId] || [];
    });

    state.currentCostumes = nextSelectedCostumes;
    costumeManager.availableCostumes = nextCostumes;
    storageService.save(
      STORAGE_KEYS.COSTUME_MAPPING_V2,
      nextSelectedCostumes,
    );
    storageService.save(
      STORAGE_KEYS.AVAILABLE_COSTUMES_V2,
      costumeManager.availableCostumes,
    );
  },

  // 按角色 id 找角色名
  findCharName(characterId) {
    for (const [characterName, characterIds] of Object.entries(
      state.currentConfig,
    )) {
      if (characterIds.includes(characterId)) {
        return characterName;
      }
    }
    return null;
  },

  // 写入一个数字设置
  applyNumericSetting(storageKey, inputId, value) {
    if (typeof value !== "number") return;

    const normalizedValue = Math.max(0, value);
    storageService.save(storageKey, normalizedValue);
    document.getElementById(inputId).value = normalizedValue;
  },

  // 导出整份本地配置
  async exportConfig() {
    await ui.withButtonLoading(
      "exportConfigBtn",
      async () => {
        const exportResult = await apiService.exportConfigFile({
          characterMapping: state.currentConfig,
          customQuotes: state.customQuotes,
          costumeMapping: state.currentCostumes,
          availableCostumes: costumeManager.availableCostumes,
          builtInCharacters: Array.from(costumeManager.builtInCharacters),
          autoPositionMode: positionManager.autoPositionMode,
          manualPositions: positionManager.manualPositions,
          customMotions: motionManager.customItems,
          customExpressions: expressionManager.customItems,
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

        await FileUtils.delay(300);
        FileUtils.downloadAsFile(downloadBlob, exportResult.filename);
        ui.showStatus("所有配置已导出", "success");
      },
      "导出中...",
    );
  },

  // 读取并导入配置文件
  async importConfig(file) {
    try {
      const response = await apiService.importConfigFile(file);
      this.applyImportedConfig(response.config);
      ui.showStatus("配置导入成功", "success");
    } catch (error) {
      console.error("配置导入失败:", error);
      ui.showStatus(`配置文件格式错误: ${error.message}`, "error");
    }
  },

  // 把导入结果写回页面和本地存储
  applyImportedConfig(config) {
    state.currentConfig = config.character_mapping;
    storageService.save(
      STORAGE_KEYS.CHARACTER_MAPPING,
      config.character_mapping,
    );

    if (Array.isArray(config.custom_quotes)) {
      quoteManager.persistCustomQuotes(config.custom_quotes);
    }

    if (config.costume_mapping || config.available_costumes) {
      costumeManager.importCostumes(config);
    }

    if (config.position_config) {
      positionManager.importPositions(config.position_config);
    }

    // 动作和表情共用同一套导入逻辑
    [["custom_motions", motionManager], ["custom_expressions", expressionManager]]
      .forEach(([configKey, manager]) => {
        if (!Array.isArray(config[configKey])) return;
        manager.customItems = [...config[configKey]];
        manager.saveCustomItems();
      });

    if (Array.isArray(config.custom_quick_fill)) {
      storageService.save(
        STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS,
        config.custom_quick_fill,
      );
    }

    this.renderConfigList();
    quoteManager.renderQuoteOptions();
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

  // 清空本地缓存
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
        storageService.removeMultiple(CLEAR_KEYS);

        await FileUtils.delay(500);
        await modalService.alert("缓存已成功清除！网页即将重新加载。");
        location.reload();
      },
      "清除中...",
    );
  },
};
