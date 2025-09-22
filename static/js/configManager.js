// 配置管理相关功能
import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { quoteManager } from "./quoteManager.js";
import { costumeManager } from "./costumeManager.js";
import { positionManager } from "./positionManager.js";
import { motionManager, expressionManager } from "./genericConfigManager.js";

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

  getAvatarId(characterId) {
    const mujicaAvatarMapping = {
      229: 6, // 纯田真奈
      337: 1, // 三角初华
      338: 2, // 若叶睦
      339: 3, // 八幡海铃
      340: 4, // 祐天寺若麦
      341: 5, // 丰川祥子
    };
    return mujicaAvatarMapping[characterId] || characterId;
  },

  // 加载配置
  async loadConfig() {
    try {
      const response = await axios.get("/api/config");
      state.set("configData", response.data);
      this.defaultConfig = response.data.character_mapping;
      const savedConfig = this.loadLocalConfig();
      if (savedConfig) {
        state.set("currentConfig", savedConfig);
        console.log("已加载本地保存的配置");
      } else {
        state.set("currentConfig", { ...this.defaultConfig });
        console.log("使用默认配置");
      }
      
      quoteManager.renderQuoteOptions();
      motionManager.init();
      expressionManager.init(); 
    } catch (error) {
      console.error("加载配置失败:", error);
      ui.showStatus("无法加载应用配置", "error");
    }
  },

  // 从 LocalStorage 加载配置
  loadLocalConfig() {
    try {
      const saved = localStorage.getItem("bestdori_character_mapping");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error("加载本地配置失败:", error);
    }
    return null;
  },

  // 保存配置到 LocalStorage
  saveLocalConfig(config) {
    try {
      localStorage.setItem(
        "bestdori_character_mapping",
        JSON.stringify(config)
      );
      return true;
    } catch (error) {
      console.error("保存本地配置失败:", error);
      return false;
    }
  },

  // 打开配置管理模态框
  async openConfigModal() {
    await ui.withButtonLoading(
      "configBtn",
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        this.renderConfigList();
        ui.openModal("configModal");
      },
      "加载配置..."
    );
  },

  // 重置为默认配置（保留服装配置）
  async resetConfig() {
    if (
      confirm(
        "【警告】此操作将恢复为系统默认角色列表。\n\n" +
          "所有自定义添加的角色及其服装配置都将被删除。\n\n" +
          "确定要继续吗？"
      )
    ) {
      await ui.withButtonLoading(
        "resetConfigBtn",
        async () => {
          const currentCostumes = { ...state.get("currentCostumes") };
          const currentAvailableCostumes = costumeManager
            ? { ...costumeManager.availableCostumes }
            : {};
          localStorage.removeItem("bestdori_character_mapping");
          state.set("currentConfig", { ...this.defaultConfig });
          localStorage.removeItem("bestdori_custom_quotes");
          state.set("customQuotes", []);
          if (costumeManager) {
            await this.updateCostumesAfterConfigReset(
              currentCostumes,
              currentAvailableCostumes
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 300));
          this.renderConfigList();
          quoteManager.renderQuoteOptions();
          ui.showStatus("已恢复默认角色配置（服装配置已保留）", "success");
        },
        "重置中..."
      );
    }
  },

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
    const configList = document.getElementById("configList");
    const sortedConfig = Object.entries(state.get("currentConfig")).sort(
      ([, idsA], [, idsB]) => {
        const idA = idsA && idsA.length > 0 ? idsA[0] : Infinity;
        const idB = idsB && idsB.length > 0 ? idsB[0] : Infinity;
        return idA - idB;
      }
    );
    this.renderNormalConfigList(sortedConfig);
  },

  renderNormalConfigList(sortedConfig) {
    const configList = document.getElementById("configList");
    const template = document.getElementById("config-item-template");
    const fragment = document.createDocumentFragment();
    sortedConfig.forEach(([name, ids]) => {
      const clone = template.content.cloneNode(true);
      const configItem = clone.querySelector(".config-item");
      const primaryId = ids && ids.length > 0 ? ids[0] : 0;
      const avatarWrapper = configItem.querySelector(".config-avatar-wrapper");
      this.updateConfigAvatar(avatarWrapper, primaryId, name);
      const nameInput = configItem.querySelector(".config-name");
      nameInput.value = name;
      const idsInput = configItem.querySelector(".config-ids");
      idsInput.value = Array.isArray(ids) ? ids.join(",") : ids;
      fragment.appendChild(configItem);
    });
    configList.innerHTML = "";
    configList.appendChild(fragment);
  },

  // 更新配置项头像
  updateConfigAvatar(avatarWrapper, id, name) {
    const avatar = avatarWrapper.querySelector(".config-avatar");
    avatar.dataset.id = id;
    const avatarId = this.getAvatarId(id);
    if (avatarId > 0) {
      avatar.className = "config-avatar";
      avatar.innerHTML = `<img src="/static/images/avatars/${avatarId}.png" alt="${name}" class="config-avatar-img">`;
      const img = avatar.querySelector("img");
      img.onerror = () => {
        avatar.innerHTML = name.charAt(0);
        avatar.classList.add("fallback");
      };
    } else {
      avatar.className = "config-avatar fallback";
      avatar.innerHTML = name.charAt(0);
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
          ui.closeModal("configModal");
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
          export_date: new Date().toISOString(),
          version: "1.1",
        };
        const dataStr = JSON.stringify(fullConfig, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        await new Promise((resolve) => setTimeout(resolve, 300));
        const a = document.createElement("a");
        a.href = url;
        a.download = `bestdori_config_${new Date()
          .toISOString()
          .slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        ui.showStatus("配置已导出（包含位置配置）", "success");
      },
      "导出中..."
    );
  },

  // 导入配置（包含所有子配置）
  importConfig(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);
        console.log("导入的配置:", config);
        if (!config || typeof config !== "object") {
          throw new Error("无效的配置文件格式");
        }
        if (config.character_mapping) {
          state.set("currentConfig", config.character_mapping);
          this.saveLocalConfig(config.character_mapping);
          console.log("角色映射已导入");
          if (config.custom_quotes && Array.isArray(config.custom_quotes)) {
            state.set("customQuotes", config.custom_quotes);
            if (
              typeof quoteManager !== "undefined" &&
              quoteManager.saveCustomQuotes
            ) {
              quoteManager.saveCustomQuotes();
              console.log("自定义引号已导入");
            }
          }
          if (
            typeof costumeManager !== "undefined" &&
            costumeManager.importCostumes
          ) {
            if (
              config.costume_mapping ||
              config.available_costumes ||
              typeof config.enable_live2d === "boolean"
            ) {
              costumeManager.importCostumes(config);
              console.log("服装配置已导入");
            }
          }
          if (
            config.position_config &&
            typeof positionManager !== "undefined" &&
            positionManager.importPositions
          ) {
            positionManager.importPositions(config.position_config);
            console.log("位置配置已导入");
          }
        } else {
          throw new Error("配置文件中没有有效数据");
        }
        this.renderConfigList();
        if (
          typeof quoteManager !== "undefined" &&
          quoteManager.renderQuoteOptions
        ) {
          quoteManager.renderQuoteOptions();
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
    if (
      !confirm(
        "【警告】此操作将删除所有本地保存的用户数据，包括：\n\n" +
          "  - 自定义角色映射\n" +
          "  - 所有角色的服装配置\n" +
          "  - 自定义引号\n" +
          "  - Live2D 布局和位置设置\n\n" +
          "网页将恢复到初始默认状态。此操作无法撤销，确定要继续吗？"
      )
    ) {
      return;
    }
    await ui.withButtonLoading(
      "clearCacheBtn",
      async () => {
        const keysToRemove = [
          "bestdori_character_mapping",
          "bestdori_custom_quotes",
          "bestdori_costume_mapping_v2",
          "bestdori_available_costumes_v2",
          "bestdori_position_config",
        ];
        console.log("正在清除以下本地缓存:", keysToRemove);
        keysToRemove.forEach((key) => {
          localStorage.removeItem(key);
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        alert("缓存已成功清除！网页即将重新加载。");
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
  }
};
