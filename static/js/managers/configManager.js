// 配置管理的入口：负责角色列表配置、导入导出、清缓存等操作
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { quoteManager } from "@managers/quoteManager.js";
import { costumeManager } from "@managers/costumeManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { modalService } from "@services/ModalService.js";
import { configUI } from "@managers/config/configUI.js";
import { configData } from "@managers/config/configData.js";

export const configManager = {
  defaultConfig: null,

  // 初始化：绑定配置列表交互和页面按钮
  init() {
    configUI.bindConfigListInteractions(this);
    this.bindActionButtons();
  },

  // 获取当前角色配置（角色名 -> ID 列表）
  getCurrentConfig() {
    return state.get("currentConfig");
  },

  // 获取用于显示的头像 ID（有些角色会映射到“替代头像”）
  getAvatarId(characterId) {
    const avatarMapping = state.get("avatarMapping") || {};
    return avatarMapping[characterId] || characterId;
  },

  // 从后端/本地加载配置（初始化整个应用的角色与引号等数据）
  async loadConfig() {
    return configData.loadConfig(this);
  },

  // 读取本地保存的角色配置
  loadLocalConfig() {
    return configData.loadLocalConfig();
  },

  // 保存角色配置到本地
  saveLocalConfig(config) {
    return configData.saveLocalConfig(config);
  },

  // 恢复默认角色列表（会清掉自定义角色；服装尽量保留已有角色的设置）
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

  // 重置角色列表后：把服装配置“对齐到新角色表”（已有角色尽量保留）
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

  // 把当前角色配置渲染到页面列表
  renderConfigList() {
    configUI.renderConfigList(this);
  },

  // 更新某一行的头像显示
  updateConfigAvatar(avatarWrapper, id, name) {
    configUI.updateConfigAvatar(this, avatarWrapper, id, name);
  },

  // 新增一行配置项（空白行）
  addConfigItem() {
    configUI.addConfigItem();
  },

  // 从页面表单读出角色配置，并保存到本地
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

  // 导出所有配置（包含服装、位置、动作表情等）
  async exportConfig() {
    return configData.exportConfig(this);
  },

  // 导入一个完整配置文件（会分发给多个子模块）
  importConfig(file) {
    return configData.importConfig(this, file);
  },

  // 清除所有本地缓存（恢复出厂设置）
  async clearLocalStorage() {
    return configData.clearLocalStorage();
  },

  // 用角色 ID 反查角色名（用于显示）
  getCharacterNameById(id) {
    for (const [name, ids] of Object.entries(state.get("currentConfig"))) {
      if (ids.includes(id)) {
        return name;
      }
    }
    return null;
  },

  // 绑定配置页面上的按钮（新增/保存/重置/导入/导出/清缓存）
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
