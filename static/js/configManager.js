// 配置管理相关功能
import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { quoteManager } from "./quoteManager.js";
import { costumeManager } from "./costumeManager.js";
import { positionManager } from "./positionManager.js";
import { motionManager, expressionManager } from "./genericConfigManager.js";
import { storageService, STORAGE_KEYS } from "./services/StorageService.js";
import { apiService } from "./services/ApiService.js";
import { modalService } from "./services/ModalService.js";
import { DOMUtils } from "./utils/DOMUtils.js";
import { DataUtils } from "./utils/DataUtils.js";

/**
 * 生成带时间戳的文件名
 * @param {string} prefix - 文件名前缀
 * @param {string} extension - 文件扩展名
 * @returns {string}
 */
function generateFilename(prefix = "file", extension = "json") {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
  return `${prefix}_${timestamp}.${extension}`;
}

export const configManager = {
  defaultConfig: null,

  init() {
    const configList = document.getElementById("configList");
    if (configList) {
      configList.addEventListener("click", (event) => {
        const removeButton = event.target.closest(".remove-btn");
        if (removeButton) {
          removeButton.closest(".config-item").remove();
        }
      });

      configList.addEventListener("input", (event) => {
        const configItem = event.target.closest(".config-item");
        if (!configItem) return;
        const avatarWrapper = configItem.querySelector(
          ".config-avatar-wrapper"
        );

        const nameInput = configItem.querySelector(".config-name");
        const name = nameInput.value || "?";

        if (event.target.classList.contains("config-ids")) {
          const newIds = event.target.value
            .split(",")
            .map((id) => parseInt(id.trim()))
            .filter((id) => !isNaN(id));
          const newPrimaryId = newIds.length > 0 ? newIds[0] : 0;
          this.updateConfigAvatar(avatarWrapper, newPrimaryId, name);
        } else if (event.target.classList.contains("config-name")) {
          const avatar = avatarWrapper.querySelector(".config-avatar");
          if (avatar.classList.contains("fallback")) {
            avatar.innerHTML = event.target.value.charAt(0) || "?";
          }
        }
      });
    }
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
    try {
      const data = await apiService.getConfig();
      state.set("configData", data);
      this.defaultConfig = data.character_mapping;
      state.set("avatarMapping", data.avatar_mapping || {});

      const savedConfig = this.loadLocalConfig();
      if (savedConfig) {
        state.set("currentConfig", savedConfig);
      } else {
        state.set("currentConfig", { ...this.defaultConfig });
      }

      quoteManager.renderQuoteOptions();
      motionManager.init();
      expressionManager.init();

    } catch (error) {
      console.error("加载配置失败:", error);
      ui.showStatus(error.message || "无法加载应用配置", "error");
    }
  },

  // 从 LocalStorage 加载配置
  loadLocalConfig() {
    return storageService.get(STORAGE_KEYS.CHARACTER_MAPPING);
  },

  // 保存配置到 LocalStorage
  saveLocalConfig(config) {
    return storageService.set(STORAGE_KEYS.CHARACTER_MAPPING, config);
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
    // 使用 DataUtils.sortBy 替代手动排序
    const sortedConfig = DataUtils.sortBy(
      Object.entries(state.get("currentConfig")),
      ([, ids]) => ids?.[0] ?? Infinity,
      "asc"
    );
    this.renderNormalConfigList(sortedConfig);
  },

  renderNormalConfigList(sortedConfig) {
    const configList = document.getElementById("configList");
    const template = document.getElementById("config-item-template");

    // 使用 map 创建所有配置项元素
    const configItems = sortedConfig.map(([name, ids]) => {
      const clone = template.content.cloneNode(true);
      const configItem = clone.querySelector(".config-item");
      const primaryId = ids?.[0] ?? 0;
      const avatarWrapper = configItem.querySelector(".config-avatar-wrapper");
      this.updateConfigAvatar(avatarWrapper, primaryId, name);

      configItem.querySelector(".config-name").value = name;
      configItem.querySelector(".config-ids").value = Array.isArray(ids)
        ? ids.join(",")
        : ids;

      return configItem;
    });

    // 使用 DOMUtils 工具函数批量更新 DOM
    DOMUtils.clearElement(configList);
    DOMUtils.appendChildren(configList, configItems);
  },

  // 更新配置项头像
  updateConfigAvatar(avatarWrapper, id, name) {
    const avatar = avatarWrapper.querySelector(".config-avatar");
    avatar.dataset.id = id;
    const avatarId = this.getAvatarId(id);

    // 使用 DOMUtils 或清空内容
    DOMUtils.clearElement(avatar);

    if (avatarId > 0) {
      avatar.className = "config-avatar";

      // 使用标准 DOM API 创建元素
      const img = DOMUtils.createElement("img", {
        src: `/static/images/avatars/${avatarId}.png`,
        alt: name,
        className: "config-avatar-img",
        loading: "lazy", // 结合方式一
      });

      // 设置错误处理
      img.addEventListener("error", () => {
        DOMUtils.clearElement(avatar);
        avatar.textContent = name.charAt(0);
        avatar.classList.add("fallback");
      });

      avatar.appendChild(img);
    } else {
      avatar.className = "config-avatar fallback";
      avatar.textContent = name.charAt(0);
    }
  },

  // 添加配置项
  addConfigItem() {
    const configList = document.getElementById("configList");
    const template = document.getElementById("config-item-template");
    const clone = template.content.cloneNode(true);
    const configItem = clone.querySelector(".config-item");
    const avatar = configItem.querySelector(".config-avatar");
    avatar.classList.add("fallback");
    avatar.dataset.id = "0";
    avatar.textContent = "?";
    configList.prepend(configItem);
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
            0
          ),
        // 将换行前空格的设置添加到导出对象中
        auto_append_spaces_before_newline: storageService.get(
          STORAGE_KEYS.AUTO_APPEND_SPACES_BEFORE_NEWLINE,
          0
        ),
          export_date: new Date().toISOString(),
          version: "1.4",
        };
        const dataStr = JSON.stringify(fullConfig, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        await new Promise((resolve) => setTimeout(resolve, 300));
        const a = document.createElement("a");
        a.href = url;
        a.download = generateFilename("bestdori_config", "json");
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        ui.showStatus("所有配置已导出", "success");
      },
      "导出中..."
    );
  },

  /**
   * 验证导入的配置对象格式
   *
   * @returns {boolean} 是否有效
   */
  validateConfig(config) {
    // 只检查是否为有效对象
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      console.error("配置验证失败：不是有效的对象");
      return false;
    }
    return true;
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
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);

        // 验证配置安全性
        if (!this.validateConfig(config)) {
          throw new Error("配置文件包含不安全的数据，导入已被阻止");
        }

        if (!config.character_mapping) {
          throw new Error("配置文件中没有有效数据");
        }

        state.set("currentConfig", config.character_mapping);
        this.saveLocalConfig(config.character_mapping);

        if (config.custom_quotes && Array.isArray(config.custom_quotes)) {
          state.set("customQuotes", config.custom_quotes);
          quoteManager.saveCustomQuotes();
        }

        if (
          config.costume_mapping ||
          config.available_costumes ||
          typeof config.enable_live2d === "boolean"
        ) {
          costumeManager.importCostumes(config);
        }

        if (config.position_config) {
          positionManager.importPositions(config.position_config);
        }

        if (config.custom_motions && Array.isArray(config.custom_motions)) {
          motionManager.customItems = [...config.custom_motions];
          motionManager.saveCustomItems();
        }

        if (
          config.custom_expressions &&
          Array.isArray(config.custom_expressions)
        ) {
          expressionManager.customItems = [...config.custom_expressions];
          expressionManager.saveCustomItems();
        }

        if (config.custom_quick_fill && Array.isArray(config.custom_quick_fill)) {
          storageService.set(
            STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS,
            config.custom_quick_fill
          );
        }

        this.renderConfigList();
        quoteManager.renderQuoteOptions();

        // 导入自动添加空格的配置
        if (typeof config.auto_append_spaces === "number") {
          const value = Math.max(0, config.auto_append_spaces);
          storageService.set(STORAGE_KEYS.AUTO_APPEND_SPACES, value);
          const appendSpacesInput = document.getElementById("appendSpaces");
          if (appendSpacesInput) {
            appendSpacesInput.value = value;
          }
        }

        // 导入自动添加换行前空格的配置
        if (typeof config.auto_append_spaces_before_newline === "number") {
          const value = Math.max(0, config.auto_append_spaces_before_newline);
          storageService.set(STORAGE_KEYS.AUTO_APPEND_SPACES_BEFORE_NEWLINE, value);
          const input = document.getElementById("appendSpacesBeforeNewline");
          if (input) {
            input.value = value;
          }
        }

        ui.showStatus("配置导入成功", "success");
      } catch (error) {
        console.error("配置导入失败:", error);
        ui.showStatus(`配置文件格式错误: ${error.message}`, "error");
      }
    };
    reader.onerror = () => {
      ui.showStatus("文件读取失败", "error");
    };
    reader.readAsText(file);
  },

  // 清除所有本地存储
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
        "网页将恢复到初始默认状态。此操作无法撤销，确定要继续吗？"
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

        console.log("正在清除以下本地缓存:", keysToRemove);
        storageService.removeMultiple(keysToRemove);

        await new Promise((resolve) => setTimeout(resolve, 500));
        await modalService.alert("缓存已成功清除！网页即将重新加载。");
        location.reload();
      },
      "清除中..."
    );
  },

  getCharacterNameById(id) {
    for (const [name, ids] of Object.entries(state.get("currentConfig"))) {
      if (ids.includes(id)) {
        return name;
      }
    }
    return null;
  },
};
