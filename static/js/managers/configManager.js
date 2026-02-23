// 配置管理的入口：负责角色列表配置、导入导出、清缓存等操作
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { quoteManager } from "@managers/quoteManager.js";
import { costumeManager } from "@managers/costumeManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { modalService } from "@services/ModalService.js";
import { configUI } from "@managers/config/configUI.js";
import { configData } from "@managers/config/configData.js";
import { costumeData } from "@managers/costume/costumeData.js";
import { FileUtils } from "@utils/FileUtils.js";

export const configManager = {
  defaultConfig: null,

  // 初始化：绑定配置列表交互和页面按钮
  init() {
    configUI.bindConfigListInteractions(this);
    this.bindActionButtons();
  },

  // 获取用于显示的头像 ID（有些角色会映射到“替代头像”）
  getAvatarId(characterId) {
    const avatarMapping = state.get("avatarMapping") || {};
    return avatarMapping[characterId] || characterId;
  },

  // 恢复默认角色列表（会清掉自定义角色；服装尽量保留已有角色的设置）
  async resetConfig() {
    const confirmed = await modalService.confirm(
      `【警告】此操作将恢复为系统默认角色列表。\n\n所有自定义添加的角色及其服装配置都将被删除。\n\n确定要继续吗？`,
    );

    if (confirmed) {
      await ui.withButtonLoading(
        "resetConfigBtn",
        async () => {
          const previousSelectedCostumes = { ...state.get("currentCostumes") };
          const previousAvailableCostumeMap = {
            ...costumeManager.availableCostumes,
          };

          storageService.remove(STORAGE_KEYS.CHARACTER_MAPPING);
          state.set("currentConfig", { ...this.defaultConfig });

          storageService.remove(STORAGE_KEYS.CUSTOM_QUOTES);
          state.set("customQuotes", []);

          await this.updateCostumesAfterConfigReset(
            previousSelectedCostumes,
            previousAvailableCostumeMap,
          );

          await FileUtils.delay(300);
          configUI.renderConfigList(this);
          quoteManager.renderQuoteOptions();
          ui.showStatus("已恢复默认角色配置（服装配置已保留）", "success");
        },
        "重置中...",
      );
    }
  },

  // 重置角色列表后：把服装配置“对齐到新角色表”（已有角色尽量保留）
  async updateCostumesAfterConfigReset(
    previousSelectedCostumes,
    previousAvailableCostumeMap,
  ) {
    const updatedSelectedCostumes = {};
    const updatedAvailableCostumes = {};
    Object.entries(this.defaultConfig).forEach(
      ([characterName, characterIds]) => {
        const primaryCharacterId = characterIds[0];

        if (Object.hasOwn(previousSelectedCostumes, characterName)) {
          updatedSelectedCostumes[characterName] =
            previousSelectedCostumes[characterName];
          updatedAvailableCostumes[characterName] =
            previousAvailableCostumeMap[characterName] || [];
        } else {
          updatedSelectedCostumes[characterName] =
            costumeManager.defaultCostumes[primaryCharacterId] || "";
          updatedAvailableCostumes[characterName] =
            costumeManager.defaultAvailableCostumes[primaryCharacterId] || [];
        }
      },
    );
    state.set("currentCostumes", updatedSelectedCostumes);
    costumeManager.availableCostumes = updatedAvailableCostumes;
    storageService.set(STORAGE_KEYS.COSTUME_MAPPING_V2, updatedSelectedCostumes);
    costumeData.saveLocalAvailableCostumes(costumeManager);
  },

  // 从页面表单读出角色配置，并保存到本地
  async saveConfig() {
    await ui.withButtonLoading(
      "saveConfigBtn",
      async () => {
        const configItems = document.querySelectorAll(".config-item");
        const newConfig = {};
        configItems.forEach((configItemElement) => {
          const characterName = configItemElement
            .querySelector(".config-name")
            .value.trim();
          const characterIdsText = configItemElement
            .querySelector(".config-ids")
            .value.trim();
          if (characterName && characterIdsText) {
            const characterIds = characterIdsText
              .split(",")
              .map((idText) => parseInt(idText.trim()))
              .filter((id) => !isNaN(id));
            if (characterIds.length > 0) {
              newConfig[characterName] = characterIds;
            }
          }
        });
        await FileUtils.delay(500);
        if (storageService.set(STORAGE_KEYS.CHARACTER_MAPPING, newConfig)) {
          state.set("currentConfig", newConfig);
          ui.showStatus("配置已保存到本地！", "success");
        } else {
          ui.showStatus("配置保存失败，可能是存储空间不足", "error");
        }
      },
      "保存中...",
    );
  },

  // 用角色 ID 反查角色名（用于显示）
  getCharacterNameById(characterId) {
    for (const [characterName, characterIds] of Object.entries(
      state.get("currentConfig"),
    )) {
      if (characterIds.includes(characterId)) {
        return characterName;
      }
    }
    return null;
  },

  // 绑定配置页面上的按钮（新增/保存/重置/导入/导出/清缓存）
  bindActionButtons() {
    document
      .getElementById("addConfigBtn")
      ?.addEventListener("click", () => configUI.addConfigItem());
    document
      .getElementById("saveConfigBtn")
      ?.addEventListener("click", () => this.saveConfig());
    document
      .getElementById("resetConfigBtn")
      ?.addEventListener("click", () => this.resetConfig());
    document
      .getElementById("exportConfigBtn")
      ?.addEventListener("click", () => configData.exportConfig(this));

    document
      .getElementById("importConfigBtn")
      ?.addEventListener("click", () => {
        document.getElementById("importConfigInput")?.click();
      });

    document
      .getElementById("importConfigInput")
      ?.addEventListener("change", (changeEvent) => {
        const file = changeEvent.target.files?.[0];
        if (file) {
          configData.importConfig(this, file);
          changeEvent.target.value = "";
        }
      });

    document
      .getElementById("clearCacheBtn")
      ?.addEventListener("click", () => configData.clearLocalStorage());
  },
};
