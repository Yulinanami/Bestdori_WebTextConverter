// 服装管理相关功能
import { DataUtils } from "./utils/DataUtils.js";
import { DOMUtils } from "./utils/DOMUtils.js";
import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";
import { storageService, STORAGE_KEYS } from "./services/StorageService.js";
import { apiService } from "./services/ApiService.js";
import { modalService } from "./services/ModalService.js";
import { eventBus, EVENTS } from "./services/EventBus.js";

export const costumeManager = {
  defaultCostumes: {},
  defaultAvailableCostumes: {},
  availableCostumes: {},
  mujicaMapping: {},

  // 模态框内的临时状态
  tempCostumeChanges: {},
  tempAvailableCostumes: {},
  originalCostumes: {},
  originalAvailableCostumes: {},

  init() {
    const costumeList = document.getElementById("costumeList");
    if (!costumeList) return;
    costumeList.addEventListener("click", (e) => {
      const target = e.target;
      const toggleBtn = target.closest(".toggle-costume-details-btn");
      if (toggleBtn) {
        const safeDomId = toggleBtn.dataset.safeDomId;
        this.toggleCostumeDetails(safeDomId);
        return;
      }
      const addBtn = target.closest(".add-costume-btn");
      if (addBtn) {
        const { characterKey, safeDomId } = addBtn.dataset;
        this.addNewCostume(characterKey, safeDomId);
        return;
      }
      const dbBtn = target.closest(".open-live2d-db-btn");
      if (dbBtn) {
        this.openLive2DDatabase();
        return;
      }
      const editBtn = target.closest(".edit-costume-btn");
      if (editBtn) {
        const { characterKey, index, costume, safeDomId } = editBtn.dataset;
        this.editCostume(characterKey, parseInt(index), costume, safeDomId);
        return;
      }
      const deleteBtn = target.closest(".delete-costume-btn");
      if (deleteBtn) {
        const { characterKey, index, safeDomId } = deleteBtn.dataset;
        this.deleteCostume(characterKey, parseInt(index), safeDomId);
        return;
      }
    });
    costumeList.addEventListener("change", (e) => {
      const select = e.target.closest(".costume-select");
      if (select) {
        const key = select.dataset.characterKey;
        this.tempCostumeChanges[key] = select.value;
      }
    });
  },

  // 生成角色的唯一标识符（使用角色名称）
  getCharacterKey(characterName) {
    return characterName;
  },

  getSafeDomId(characterName) {
    return characterName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_");
  },

  /**
   * 转换可用服装列表为基于角色名称的映射
   * 原始数据按角色ID存储,转换为按角色名称存储
   * 自动包含默认服装(如果不在列表中会自动添加)
   * @returns {Object} 角色名称到服装ID数组的映射
   */
  convertAvailableCostumesToNameBased() {
    const nameBased = {};
    Object.entries(state.get("currentConfig")).forEach(([name, ids]) => {
      if (ids && ids.length > 0) {
        const primaryId = ids[0];
        const characterKey = this.getCharacterKey(name);
        if (this.defaultAvailableCostumes[primaryId]) {
          nameBased[characterKey] = [
            ...this.defaultAvailableCostumes[primaryId],
          ];
        } else {
          nameBased[characterKey] = [];
        }
        const defaultCostume = this.defaultCostumes[primaryId];
        if (
          defaultCostume &&
          !nameBased[characterKey].includes(defaultCostume)
        ) {
          nameBased[characterKey].push(defaultCostume);
        }
      }
    });

    return nameBased;
  },

  // 转换默认服装配置为基于角色名称的映射
  convertDefaultCostumesToNameBased() {
    const nameBased = {};
    Object.entries(state.get("currentConfig")).forEach(([name, ids]) => {
      if (ids && ids.length > 0) {
        const primaryId = ids[0];
        const characterKey = this.getCharacterKey(name);
        const defaultCostume = this.defaultCostumes[primaryId];
        if (defaultCostume) {
          const availableList = this.defaultAvailableCostumes[primaryId] || [];
          if (availableList.includes(defaultCostume)) {
            nameBased[characterKey] = defaultCostume;
          } else {
            nameBased[characterKey] = availableList[0] || "";
          }
        } else {
          nameBased[characterKey] = "";
        }
      }
    });

    return nameBased;
  },

  // 加载服装配置
  async loadCostumeConfig() {
    try {
      const costumeData = await apiService.getCostumes();
      this.defaultAvailableCostumes = costumeData.available_costumes;
      this.defaultCostumes = costumeData.default_costumes;

      const configData = await apiService.getConfig();
      this.builtInCharacters = new Set(
        Object.keys(configData.character_mapping)
      );

      const savedCostumes = this.loadLocalCostumes();
      if (savedCostumes) {
        state.set("currentCostumes", savedCostumes);
      } else {
        state.set("currentCostumes", this.convertDefaultCostumesToNameBased());
      }

      const savedAvailableCostumes = this.loadLocalAvailableCostumes();
      if (savedAvailableCostumes) {
        this.availableCostumes = savedAvailableCostumes;
      } else {
        this.availableCostumes = this.convertAvailableCostumesToNameBased();
      }
    } catch (error) {
      console.error("加载服装配置失败:", error);
      ui.showStatus(error.message || "无法加载服装配置", "error");
    }
  },

  // 从 LocalStorage 加载服装配置
  loadLocalCostumes() {
    return storageService.get(STORAGE_KEYS.COSTUME_MAPPING_V2);
  },

  // 保存服装配置到 LocalStorage
  saveLocalCostumes(costumes) {
    return storageService.set(STORAGE_KEYS.COSTUME_MAPPING_V2, costumes);
  },

  // 加载本地可用服装列表
  loadLocalAvailableCostumes() {
    return storageService.get(STORAGE_KEYS.AVAILABLE_COSTUMES_V2);
  },

  // 修改保存可用服装列表的方法，添加验证
  saveLocalAvailableCostumes() {
    const hasValidData =
      Object.keys(this.availableCostumes).length > 0 &&
      Object.values(this.availableCostumes).some((list) => Array.isArray(list));

    if (!hasValidData) {
      console.warn("尝试保存空的可用服装列表，操作已取消");
      return false;
    }

    return storageService.set(
      STORAGE_KEYS.AVAILABLE_COSTUMES_V2,
      this.availableCostumes
    );
  },

  /**
   * 渲染服装配置列表
   * 为每个角色创建配置卡片,包含:
   * - 角色头像和名称
   * - 当前服装下拉选择器
   * - 可折叠的详细配置区域(服装ID列表、添加/编辑/删除按钮)
   * 使用临时状态(tempCostumeChanges/tempAvailableCostumes)进行编辑
   */
  renderCostumeList() {
    const costumeList = document.getElementById("costumeList");
    const template = document.getElementById("costume-item-template");
    const fragment = document.createDocumentFragment();
    // 使用 DataUtils.sortBy 替代手动排序
    const characterEntries = DataUtils.sortBy(
      Object.entries(state.get("currentConfig")),
      ([, ids]) => ids?.[0] ?? Infinity,
      "asc"
    );

    characterEntries.forEach(([name, ids]) => {
      if (!ids || ids.length === 0) return;
      const clone = template.content.cloneNode(true);
      const costumeItem = clone.querySelector(".costume-config-item");
      const primaryId = ids[0];
      const characterKey = this.getCharacterKey(name);
      const safeDomId = this.getSafeDomId(name);
      const avatarId = configManager.getAvatarId(primaryId);
      const availableForCharacter =
        this.tempAvailableCostumes[characterKey] || [];
      const currentCostume = this.tempCostumeChanges[characterKey] || "";

      // Header
      const avatarDiv = costumeItem.querySelector(".config-avatar");
      avatarDiv.dataset.id = primaryId;
      const avatarPath =
        avatarId > 0 ? `/static/images/avatars/${avatarId}.png` : "";
      if (avatarId > 0) {
        avatarDiv.innerHTML = `<img src="${avatarPath}" alt="${name}" class="config-avatar-img" onerror="this.style.display='none'; this.parentElement.innerHTML='${name.charAt(
          0
        )}'; this.parentElement.classList.add('fallback');">`;
      } else {
        avatarDiv.textContent = name.charAt(0);
        avatarDiv.classList.add("fallback");
      }
      costumeItem.querySelector(
        ".costume-character-name"
      ).textContent = `${name} (ID: ${primaryId})`;

      const toggleBtn = costumeItem.querySelector(
        ".toggle-costume-details-btn"
      );
      toggleBtn.dataset.safeDomId = safeDomId;
      toggleBtn.querySelector("span").id = `toggle-${safeDomId}`;
      const detailsDiv = costumeItem.querySelector(".costume-details");
      detailsDiv.id = `costume-details-${safeDomId}`;
      const select = costumeItem.querySelector(".costume-select");
      select.dataset.characterKey = characterKey;
      select.innerHTML =
        `<option value="">无服装</option>` +
        availableForCharacter
          .map(
            (costume) =>
              `<option value="${costume}" ${
                costume === currentCostume ? "selected" : ""
              }>${costume}</option>`
          )
          .join("");
      const addBtn = costumeItem.querySelector(".add-costume-btn");
      addBtn.dataset.characterKey = characterKey;
      addBtn.dataset.safeDomId = safeDomId;
      const listItems = costumeItem.querySelector(".costume-list-items");
      listItems.id = `costume-list-${safeDomId}`;
      listItems.innerHTML = this.renderCostumeListItems(
        characterKey,
        availableForCharacter,
        safeDomId
      );
      fragment.appendChild(costumeItem);
    });
    DOMUtils.clearElement(costumeList);
    costumeList.appendChild(fragment);
  },

  // 添加打开 Live2D 数据库的方法
  openLive2DDatabase() {
    window.open(
      "https://bestdori.com/tool/explorer/asset/jp/live2d/chara",
      "_blank"
    );
  },

  // 渲染服装列表项
  renderCostumeListItems(characterKey, costumes, safeDomId) {
    if (!costumes || costumes.length === 0) {
      return '<div class="empty-costume-list">暂无可用服装</div>';
    }

    return costumes
      .map(
        (costume, index) => `
        <div class="costume-list-item">
            <span>${costume}</span>
            <div class="costume-item-actions">
                <button class="btn btn-icon-action edit-costume-btn" title="编辑服装ID" data-character-key="${characterKey}" data-index="${index}" data-costume="${costume}" data-safe-dom-id="${safeDomId}">
                    <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="btn btn-icon-action btn-icon-danger delete-costume-btn" title="删除此服装" data-character-key="${characterKey}" data-index="${index}" data-safe-dom-id="${safeDomId}">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        </div>
    `
      )
      .join("");
  },

  // 切换服装详情显示
  toggleCostumeDetails(safeDomId) {
    const details = document.getElementById(`costume-details-${safeDomId}`);
    const toggle = document.getElementById(`toggle-${safeDomId}`);
    // 检查元素是否隐藏（通过class或style）
    const isHidden =
      details.classList.contains("hidden") ||
      details.style.display === "none" ||
      window.getComputedStyle(details).display === "none";

    if (isHidden) {
      details.classList.remove("hidden");
      details.style.display = "block";
      toggle.textContent = "▲";
    } else {
      details.classList.add("hidden");
      details.style.display = "none";
      toggle.textContent = "▼";
    }
  },

  // 添加新服装（只修改临时状态）
  async addNewCostume(characterKey, safeDomId) {
    const costumeId = await modalService.prompt("请输入新的服装ID：");
    if (costumeId && costumeId.trim()) {
      const trimmedId = costumeId.trim();
      if (!this.tempAvailableCostumes[characterKey]) {
        this.tempAvailableCostumes[characterKey] = [];
      }
      if (this.tempAvailableCostumes[characterKey].includes(trimmedId)) {
        ui.showStatus("该服装ID已存在", "error");
        return;
      }
      this.tempAvailableCostumes[characterKey].push(trimmedId);
      this.updateCostumeListUI(characterKey, safeDomId);
      ui.showStatus(`已在临时列表添加服装: ${trimmedId}`, "info");
    }
  },

  // 编辑服装（只修改临时状态）
  async editCostume(characterKey, index, oldCostume, safeDomId) {
    const newCostume = await modalService.prompt("编辑服装ID：", oldCostume);
    if (newCostume && newCostume.trim() && newCostume !== oldCostume) {
      const trimmedId = newCostume.trim();
      if (this.tempAvailableCostumes[characterKey].includes(trimmedId)) {
        ui.showStatus("该服装ID已存在", "error");
        return;
      }
      this.tempAvailableCostumes[characterKey][index] = trimmedId;
      if (this.tempCostumeChanges[characterKey] === oldCostume) {
        this.tempCostumeChanges[characterKey] = trimmedId;
      }
      this.updateCostumeListUI(characterKey, safeDomId);
    }
  },

  // 删除服装（只修改临时状态）
  async deleteCostume(characterKey, index, safeDomId) {
    const costume = this.tempAvailableCostumes[characterKey][index];
    const confirmed = await modalService.confirm(
      `确定要删除服装 "${costume}" 吗？`
    );
    if (confirmed) {
      this.tempAvailableCostumes[characterKey].splice(index, 1);
      if (this.tempCostumeChanges[characterKey] === costume) {
        this.tempCostumeChanges[characterKey] = "";
      }
      this.updateCostumeListUI(characterKey, safeDomId);
    }
  },

  // 更新服装列表UI（基于临时状态）
  updateCostumeListUI(characterKey, safeDomId) {
    const listContainer = document.getElementById(`costume-list-${safeDomId}`);
    if (listContainer) {
      const costumes = this.tempAvailableCostumes[characterKey] || [];
      listContainer.innerHTML = this.renderCostumeListItems(
        characterKey,
        costumes,
        safeDomId
      );
    }
    const costumeDetailsContainer = document.getElementById(
      `costume-details-${safeDomId}`
    );
    if (costumeDetailsContainer) {
      const select = costumeDetailsContainer.querySelector(".costume-select");
      if (select && select.dataset.characterKey === characterKey) {
        const currentValue = this.tempCostumeChanges[characterKey] || "";
        const availableForCharacter =
          this.tempAvailableCostumes[characterKey] || [];
        select.innerHTML = `
                    <option value="">无服装</option>
                    ${availableForCharacter
                      .map(
                        (costume) =>
                          `<option value="${costume}" ${
                            costume === currentValue ? "selected" : ""
                          }>${costume}</option>`
                      )
                      .join("")}
                `;
        select.value = currentValue;
      }
    }
  },

  // 保存所有临时更改
  async saveCostumes() {
    await ui.withButtonLoading(
      "saveCostumesBtn",
      async () => {
        state.set(
          "currentCostumes",
          DataUtils.deepClone(this.tempCostumeChanges)
        );
        this.availableCostumes = DataUtils.deepClone(
          this.tempAvailableCostumes
        );
        this.saveLocalCostumes(state.get("currentCostumes"));
        this.saveLocalAvailableCostumes();
        await new Promise((resolve) => setTimeout(resolve, 300));
        ui.showStatus("服装配置已保存！", "success");
        eventBus.emit(EVENTS.COSTUME_SAVED, state.get("currentCostumes"));
      },
      "保存中..."
    );
  },

  // 重置为默认服装
  async resetCostumes() {
    const confirmed = await modalService.confirm(
      "确定要恢复默认服装配置吗？这将只重置内置角色的服装设置，自定义角色的服装配置将保留。"
    );

    if (confirmed) {
      await ui.withButtonLoading(
        "resetCostumesBtn",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const customCharacterCostumes = {};
          const customCharacterAvailableCostumes = {};
          Object.entries(state.get("currentConfig")).forEach(([name, ids]) => {
            if (!this.builtInCharacters.has(name)) {
              const characterKey = this.getCharacterKey(name);
              if (this.tempCostumeChanges[characterKey] !== undefined) {
                customCharacterCostumes[characterKey] =
                  this.tempCostumeChanges[characterKey];
              }
              if (this.tempAvailableCostumes[characterKey]) {
                customCharacterAvailableCostumes[characterKey] = [
                  ...this.tempAvailableCostumes[characterKey],
                ];
              }
            }
          });
          const defaultCostumesNameBased =
            this.convertDefaultCostumesToNameBased();
          const defaultAvailableCostumesNameBased =
            this.convertAvailableCostumesToNameBased();
          this.tempCostumeChanges = {
            ...defaultCostumesNameBased,
            ...customCharacterCostumes,
          };
          this.tempAvailableCostumes = {
            ...defaultAvailableCostumesNameBased,
            ...customCharacterAvailableCostumes,
          };
          this.renderCostumeList();
          ui.showStatus("已在编辑器中恢复默认，请保存以生效", "info");
        },
        "恢复中..."
      );
    }
  },

  // 导出配置时包含服装配置
  exportWithCostumes(config) {
    return {
      ...config,
      costume_mapping: state.get("currentCostumes"),
      available_costumes: this.availableCostumes,
    };
  },

  // 导入配置时处理服装配置
  importCostumes(config) {
    if (config.costume_mapping) {
      state.set("currentCostumes", config.costume_mapping);
      this.saveLocalCostumes(config.costume_mapping);
    }
    if (config.built_in_characters) {
      this.builtInCharacters = new Set(config.built_in_characters);
    }
    if (config.available_costumes) {
      this.availableCostumes = config.available_costumes;
      this.saveLocalAvailableCostumes();
    } else if (config.costume_mapping && !config.available_costumes) {
      this.availableCostumes = this.convertAvailableCostumesToNameBased();
      this.saveLocalAvailableCostumes();
    }
  },

  // 转换导入的基于ID的可用服装为基于名称的格式
  convertImportedAvailableCostumes(idBasedCostumes) {
    const nameBased = {};
    Object.entries(state.get("currentConfig")).forEach(([name, ids]) => {
      if (ids && ids.length > 0) {
        const primaryId = ids[0];
        const characterKey = this.getCharacterKey(name);
        if (idBasedCostumes[primaryId]) {
          nameBased[characterKey] = [...idBasedCostumes[primaryId]];
        }
      }
    });
    return nameBased;
  },
  getCostumeForCharacter(characterId) {
    const characterName = configManager.getCharacterNameById(characterId);
    return state.get("currentCostumes")[characterName] || "";
  },
};
