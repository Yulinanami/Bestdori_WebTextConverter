// 配置管理相关功能
import { state } from "./stateManager.js";
import { ui } from "../utils/uiUtils.js";
import { quoteManager } from "./quoteManager.js";
import { costumeManager } from "./costumeManager.js";
import { storageService, STORAGE_KEYS } from "../services/StorageService.js";
import { modalService } from "../services/ModalService.js";
import { configUI } from "./configUI.js";
import { configData } from "./configData.js";

export const configManager = {
  defaultConfig: null,

  init() {
    configUI.bindConfigListInteractions(this);
    this.bindActionButtons();
  },

  getCurrentConfig() {
    return state.get("currentConfig");
  },

  /**
   * 获取角色头像ID
   * 使用avatar_mapping配置将特殊角色ID映射到对应的头像ID
   * 例如: Mujica成员(ID 337-341)映射到Mujica头像(ID 1-6)
   * @returns {number} 头像ID
   */
  getAvatarId(characterId) {
    const avatarMapping = state.get("avatarMapping") || {};
    return avatarMapping[characterId] || characterId;
  },

  // 加载配置
  async loadConfig() {
    return configData.loadConfig(this);
  },

  // 从 LocalStorage 加载配置
  loadLocalConfig() {
    return configData.loadLocalConfig();
  },

  // 保存配置到 LocalStorage
  saveLocalConfig(config) {
    return configData.saveLocalConfig(config);
  },

  // 重置为默认配置（保留服装配置）
  async resetConfig() {
    const confirmed = await modalService.confirm(
      "【警告】此操作将恢复为系统默认角色列表。\n\n" +
        "所有自定义添加的角色及其服装配置都将被删除。\n\n" +
        "确定要继续吗？"
    );

    if (confirmed) {
      await ui.withButtonLoading(
        "resetConfigBtn",
        async () => {
          const currentCostumes = { ...state.get("currentCostumes") };
          const currentAvailableCostumes = {
            ...costumeManager.availableCostumes,
          };

          storageService.remove(STORAGE_KEYS.CHARACTER_MAPPING);
          state.set("currentConfig", { ...this.defaultConfig });

          storageService.remove(STORAGE_KEYS.CUSTOM_QUOTES);
          state.set("customQuotes", []);

          await this.updateCostumesAfterConfigReset(
            currentCostumes,
            currentAvailableCostumes
          );

          await new Promise((resolve) => setTimeout(resolve, 300));
          this.renderConfigList();
          quoteManager.renderQuoteOptions();
          ui.showStatus("已恢复默认角色配置（服装配置已保留）", "success");
        },
        "重置中..."
      );
    }
  },

  /**
   * 重置角色配置后更新服装配置
   * 保留现有角色的服装设置,为新角色使用默认服装
   * 确保重置角色列表时不会丢失用户已配置的服装
   */
  async updateCostumesAfterConfigReset(
    previousCostumes,
    previousAvailableCostumes
  ) {
    const newCostumes = {};
    const newAvailableCostumes = {};
    Object.entries(this.defaultConfig).forEach(([name, ids]) => {
      const characterKey = costumeManager.getCharacterKey(name);
      const primaryId = ids[0];

      if (previousCostumes.hasOwnProperty(characterKey)) {
        newCostumes[characterKey] = previousCostumes[characterKey];
        newAvailableCostumes[characterKey] =
          previousAvailableCostumes[characterKey] || [];
      } else {
        newCostumes[characterKey] =
          costumeManager.defaultCostumes[primaryId] || "";
        newAvailableCostumes[characterKey] =
          costumeManager.defaultAvailableCostumes[primaryId] || [];
      }
    });
    state.set("currentCostumes", newCostumes);
    costumeManager.availableCostumes = newAvailableCostumes;
    costumeManager.saveLocalCostumes(newCostumes);
    costumeManager.saveLocalAvailableCostumes();
  },

  // 渲染配置列表
  renderConfigList() {
    configUI.renderConfigList(this);
  },

  // 更新配置项头像
  updateConfigAvatar(avatarWrapper, id, name) {
    configUI.updateConfigAvatar(this, avatarWrapper, id, name);
  },

  // 添加配置项
  addConfigItem() {
    configUI.addConfigItem();
  },

  // 保存配置（只保存到本地）
  async saveConfig() {
    await ui.withButtonLoading(
      "saveConfigBtn",
      async () => {
        const configItems = document.querySelectorAll(".config-item");
        const newConfig = {};
        configItems.forEach((item) => {
          const name = item.querySelector(".config-name").value.trim();
          const idsStr = item.querySelector(".config-ids").value.trim();
          if (name && idsStr) {
            const ids = idsStr
              .split(",")
              .map((id) => parseInt(id.trim()))
              .filter((id) => !isNaN(id));
            if (ids.length > 0) {
              newConfig[name] = ids;
            }
          }
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (this.saveLocalConfig(newConfig)) {
          state.set("currentConfig", newConfig);
          ui.showStatus("配置已保存到本地！", "success");
        } else {
          ui.showStatus("配置保存失败，可能是存储空间不足", "error");
        }
      },
      "保存中..."
    );
  },

  // 导出配置（包含位置配置）
  async exportConfig() {
    return configData.exportConfig(this);
  },

  /**
   * 导入完整配置文件
   * 支持导入多个子系统配置:
   * - character_mapping: 角色映射
   * - custom_quotes: 自定义引号
   * - costume_mapping/available_costumes: 服装配置
   * - position_config: 位置配置
   * 解析JSON文件后依次调用各子系统的导入方法
   */
  importConfig(file) {
    return configData.importConfig(this, file);
  },

  // 清除所有本地存储
  async clearLocalStorage() {
    return configData.clearLocalStorage();
  },

  getCharacterNameById(id) {
    for (const [name, ids] of Object.entries(state.get("currentConfig"))) {
      if (ids.includes(id)) {
        return name;
      }
    }
    return null;
  },

  bindActionButtons() {
    const addBtn = document.getElementById("addConfigBtn");
    if (addBtn) {
      addBtn.addEventListener("click", this.addConfigItem.bind(this));
    }

    const saveBtn = document.getElementById("saveConfigBtn");
    if (saveBtn) {
      saveBtn.addEventListener("click", this.saveConfig.bind(this));
    }

    const resetBtn = document.getElementById("resetConfigBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", this.resetConfig.bind(this));
    }

    const exportBtn = document.getElementById("exportConfigBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", this.exportConfig.bind(this));
    }

    const importBtn = document.getElementById("importConfigBtn");
    if (importBtn) {
      importBtn.addEventListener("click", () => {
        const importInput = document.getElementById("importConfigInput");
        if (importInput) {
          importInput.click();
        }
      });
    }

    const importInput = document.getElementById("importConfigInput");
    if (importInput) {
      importInput.addEventListener("change", (e) => {
        const files = e.target.files;
        const file = files && files[0];
        if (file) {
          this.importConfig(file);
          e.target.value = "";
        }
      });
    }

    const clearCacheBtn = document.getElementById("clearCacheBtn");
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener(
        "click",
        this.clearLocalStorage.bind(this)
      );
    }
  },
};
