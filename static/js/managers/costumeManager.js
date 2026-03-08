// 服装配置
import { modalService } from "@services/ModalService.js";
import { DataUtils } from "@utils/DataUtils.js";
import { ui } from "@utils/uiUtils.js";
import { state } from "@managers/stateManager.js";
import { FileUtils } from "@utils/FileUtils.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { apiService } from "@services/ApiService.js";
import { renderCharacterAvatar } from "@utils/avatarUtils.js";

export const costumeManager = {
  defaultCostumes: {},
  defaultAvailableCostumes: {},
  availableCostumes: {},
  builtInCharacters: new Set(),

  tempCostumeChanges: {},
  tempAvailableCostumes: {},
  escCloseBound: false,

  // 初始化服装页
  init() {
    this.bindListEvents();
    this.bindActionButtons();
    this.bindEscCloseCostumeDetails();
  },

  // 绑定按钮
  bindActionButtons() {
    [["saveCostumesBtn", () => this.saveCostumes()], ["resetCostumesBtn", () => this.resetCostumes()]].forEach(([buttonId, handler]) => {
      document.getElementById(buttonId).addEventListener("click", handler);
    });
  },

  // 绑定列表里的点击和切换
  bindListEvents() {
    const costumeList = document.getElementById("costumeList");
    costumeList.addEventListener("click", (clickEvent) => this.handleListClick(clickEvent));
    costumeList.addEventListener("change", (changeEvent) => this.handleListChange(changeEvent));
  },

  // 处理列表点击
  handleListClick(clickEvent) {
    const actionTargets = [
      [".toggle-costume-details-btn", (button) => this.toggleCostumeDetails(button.dataset.safeDomId)],
      [".add-costume-btn", (button) => this.addNewCostume(button.dataset.characterName, button.dataset.safeDomId)],
      [".open-live2d-db-btn", () => window.open("https://bestdori.com/tool/explorer/asset/jp/live2d/chara", "_blank")],
      [".edit-costume-btn", (button) => this.editCostume(button.dataset.characterName, Number.parseInt(button.dataset.index, 10), button.dataset.costume, button.dataset.safeDomId)],
      [".delete-costume-btn", (button) => this.deleteCostume(button.dataset.characterName, Number.parseInt(button.dataset.index, 10), button.dataset.safeDomId)],
    ];

    for (const [selector, handler] of actionTargets) {
      const target = clickEvent.target.closest(selector);
      if (target) {
        handler(target);
        return;
      }
    }
  },

  // 处理下拉框变化
  handleListChange(changeEvent) {
    const select = changeEvent.target.closest(".costume-select");
    if (select) this.tempCostumeChanges[select.dataset.characterName] = select.value;
  },

  // 绑定 Esc 关闭详情
  bindEscCloseCostumeDetails() {
    if (this.escCloseBound) return;
    this.escCloseBound = true;

    document.addEventListener("keydown", (keyboardEvent) => {
      if (keyboardEvent.key === "Escape" && this.closeAllCostumeDetails()) {
        keyboardEvent.preventDefault();
      }
    });
  },

  // 进入页面前准备临时数据
  prepareStep() {
    this.tempCostumeChanges = DataUtils.deepClone(state.currentCostumes);
    this.tempAvailableCostumes = DataUtils.deepClone(this.availableCostumes);
    this.renderCostumeList();
  },

  // 加载服装配置
  async loadConfig() {
    try {
      const costumeConfigResponse = await apiService.fetchJson("/api/costumes");
      this.defaultAvailableCostumes = costumeConfigResponse.available_costumes;
      this.defaultCostumes = costumeConfigResponse.default_costumes;

      const baseConfigData =
        state.configData || (await apiService.fetchJson("/api/config"));
      this.builtInCharacters = new Set(
        Object.keys(baseConfigData.character_mapping),
      );

      const savedSelectedCostumes = storageService.load(
        STORAGE_KEYS.COSTUME_MAPPING_V2,
      );
      state.currentCostumes =
        savedSelectedCostumes || this.convertDefaultCostumesToNameBased();

      const savedAvailableCostumeMap = storageService.load(
        STORAGE_KEYS.AVAILABLE_COSTUMES_V2,
      );
      this.availableCostumes =
        savedAvailableCostumeMap || this.convertAvailableCostumesToNameBased();
    } catch (error) {
      console.error("加载服装配置失败:", error);
      ui.showStatus(error.message || "无法加载服装配置", "error");
    }
  },

  // 把可用服装转成按角色名存
  convertAvailableCostumesToNameBased() {
    return Object.fromEntries(
      Object.entries(state.currentConfig).map(
        ([characterName, characterIds]) => {
          const primaryCharacterId = characterIds[0];
          const isBuiltInCharacter = this.builtInCharacters.has(characterName);
          const availableCostumes = isBuiltInCharacter
            ? [...(this.defaultAvailableCostumes[primaryCharacterId] || [])]
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

  // 把默认服装转成按角色名存
  convertDefaultCostumesToNameBased() {
    return Object.fromEntries(
      Object.entries(state.currentConfig).map(
        ([characterName, characterIds]) => {
          const primaryCharacterId = characterIds[0];
          if (!this.builtInCharacters.has(characterName)) {
            return [characterName, ""];
          }

          const defaultCostumeId = this.defaultCostumes[primaryCharacterId];
          const availableCostumes =
            this.defaultAvailableCostumes[primaryCharacterId] || [];
          const selectedCostume =
            defaultCostumeId && availableCostumes.includes(defaultCostumeId)
              ? defaultCostumeId
              : availableCostumes[0] || "";
          return [characterName, selectedCostume];
        },
      ),
    );
  },

  // 导入服装配置
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
      this.availableCostumes = this.convertAvailableCostumesToNameBased();
      storageService.save(
        STORAGE_KEYS.AVAILABLE_COSTUMES_V2,
        this.availableCostumes,
      );
    }
  },

// 渲染一个服装下拉框
  renderCostumeSelect(costumeSelect, availableCostumes, selectedCostumeId = "") {
    costumeSelect.replaceChildren(new Option("无服装", ""));
    availableCostumes.forEach((costumeId) => {
      costumeSelect.add(new Option(costumeId, costumeId));
    });
    costumeSelect.value = selectedCostumeId;
  },

// 渲染服装列表
  renderCostumeList() {
    const costumeList = document.getElementById("costumeList");
    const template = document.getElementById("costume-item-template");
    const fragment = document.createDocumentFragment();
    const characterEntries = DataUtils.sortBy(
      Object.entries(state.currentConfig),
      ([, characterIds]) => characterIds?.[0] ?? Number.POSITIVE_INFINITY,
      "asc",
    );

    characterEntries.forEach(([characterName, characterIds]) => {
      const clone = template.content.cloneNode(true);
      const costumeItem = clone.querySelector(".costume-config-item");
      const primaryCharacterId = characterIds[0];
      const safeDomId = characterName.replace(
        /[^a-zA-Z0-9\u4e00-\u9fa5]/g,
        "_",
      );
      const availableCostumesForCharacter =
        this.tempAvailableCostumes[characterName] || [];
      const selectedCostumeId = this.tempCostumeChanges[characterName] || "";

      renderCharacterAvatar(
        costumeItem.querySelector(".config-avatar"),
        primaryCharacterId,
        characterName,
      );
      costumeItem.querySelector(".costume-character-name").textContent =
        `${characterName} (ID: ${primaryCharacterId})`;

      const toggleButton = costumeItem.querySelector(
        ".toggle-costume-details-btn",
      );
      toggleButton.dataset.safeDomId = safeDomId;
      toggleButton.querySelector("span").id = `toggle-${safeDomId}`;

      const detailsDiv = costumeItem.querySelector(".costume-details");
      detailsDiv.id = `costume-details-${safeDomId}`;

      const costumeSelect = costumeItem.querySelector(".costume-select");
      costumeSelect.dataset.characterName = characterName;
      this.renderCostumeSelect(
        costumeSelect,
        availableCostumesForCharacter,
        selectedCostumeId,
      );

      const addButton = costumeItem.querySelector(".add-costume-btn");
      addButton.dataset.characterName = characterName;
      addButton.dataset.safeDomId = safeDomId;

      const listItems = costumeItem.querySelector(".costume-list-items");
      listItems.id = `costume-list-${safeDomId}`;
      listItems.innerHTML = this.renderCostumeListItems(
        characterName,
        availableCostumesForCharacter,
        safeDomId,
      );

      fragment.appendChild(costumeItem);
    });

    costumeList.replaceChildren();
    costumeList.appendChild(fragment);
  },

  renderCostumeListItems(characterName, availableCostumeIds, safeDomId) {
    if (availableCostumeIds.length === 0) {
      return '<div class="empty-costume-list">暂无可用服装</div>';
    }

    return availableCostumeIds
      .map(
        (costumeId, index) => `
        <div class="costume-list-item">
            <span>${costumeId}</span>
            <div class="costume-item-actions">
                <button class="btn btn-icon-action edit-costume-btn" title="编辑服装ID" data-character-name="${characterName}" data-index="${index}" data-costume="${costumeId}" data-safe-dom-id="${safeDomId}">
                    <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="btn btn-icon-action btn-icon-danger delete-costume-btn" title="删除此服装" data-character-name="${characterName}" data-index="${index}" data-safe-dom-id="${safeDomId}">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        </div>
    `,
      )
      .join("");
  },

  updateCostumeListUI(characterName, safeDomId) {
    const availableCostumesForCharacter =
      this.tempAvailableCostumes[characterName] || [];
    const selectedCostumeId = this.tempCostumeChanges[characterName] || "";
    const detailsContainer = document.getElementById(`costume-details-${safeDomId}`);
    const listContainer = document.getElementById(`costume-list-${safeDomId}`);
    const costumeSelect = detailsContainer.querySelector(".costume-select");

    listContainer.innerHTML = this.renderCostumeListItems(
      characterName,
      availableCostumesForCharacter,
      safeDomId,
    );

    this.renderCostumeSelect(
      costumeSelect,
      availableCostumesForCharacter,
      selectedCostumeId,
    );
  },

  async saveCostumes() {
    await ui.withButtonLoading(
      "saveCostumesBtn",
      async () => {
        state.currentCostumes = DataUtils.deepClone(this.tempCostumeChanges);
        this.availableCostumes = DataUtils.deepClone(this.tempAvailableCostumes);
        storageService.save(
          STORAGE_KEYS.COSTUME_MAPPING_V2,
          state.currentCostumes,
        );
        storageService.save(
          STORAGE_KEYS.AVAILABLE_COSTUMES_V2,
          this.availableCostumes,
        );
        await FileUtils.delay(300);
        ui.showStatus("服装配置已保存！", "success");
      },
      "保存中...",
    );
  },

  async resetCostumes() {
    const confirmed = await modalService.confirm(
      "确定要恢复默认服装配置吗？这将只重置内置角色的服装设置，自定义角色的服装配置将保留。",
    );
    if (!confirmed) {
      return;
    }

    await ui.withButtonLoading(
      "resetCostumesBtn",
      async () => {
        await FileUtils.delay(300);
        const {
          customCharacterCostumes,
          customCharacterAvailableCostumes,
        } = this.collectCustomCostumeState();

        this.tempCostumeChanges = {
          ...this.convertDefaultCostumesToNameBased(),
          ...customCharacterCostumes,
        };
        this.tempAvailableCostumes = {
          ...this.convertAvailableCostumesToNameBased(),
          ...customCharacterAvailableCostumes,
        };
        this.renderCostumeList();
        ui.showStatus("已在编辑器中恢复默认，请保存以生效", "info");
      },
      "恢复中...",
    );
  },

  collectCustomCostumeState() {
    const customCharacterCostumes = {};
    const customCharacterAvailableCostumes = {};

    Object.entries(state.currentConfig).forEach(([characterName]) => {
      if (this.builtInCharacters.has(characterName)) {
        return;
      }

      if (this.tempCostumeChanges[characterName] !== undefined) customCharacterCostumes[characterName] = this.tempCostumeChanges[characterName];

      if (this.tempAvailableCostumes[characterName]) {
        customCharacterAvailableCostumes[characterName] = [
          ...this.tempAvailableCostumes[characterName],
        ];
      }
    });

    return {
      customCharacterCostumes,
      customCharacterAvailableCostumes,
    };
  },

  ensureTempAvailableCostumes(characterName) {
    if (!Array.isArray(this.tempAvailableCostumes[characterName])) this.tempAvailableCostumes[characterName] = [];
    return this.tempAvailableCostumes[characterName];
  },

  replaceSelectedCostume(characterName, currentCostumeId, nextCostumeId = "") {
    if (this.tempCostumeChanges[characterName] === currentCostumeId) this.tempCostumeChanges[characterName] = nextCostumeId;
  },

  updateCostumeDetailsVisibility(safeDomId, visible) {
    const details = document.getElementById(`costume-details-${safeDomId}`);
    const toggle = document.getElementById(`toggle-${safeDomId}`);
    details.classList.toggle("hidden", !visible);
    details.style.display = visible ? "block" : "none";
    toggle.textContent = visible ? "▲" : "▼";
  },

  toggleCostumeDetails(safeDomId) {
    const details = document.getElementById(`costume-details-${safeDomId}`);
    const isHidden =
      details.classList.contains("hidden") ||
      details.style.display === "none" ||
      window.getComputedStyle(details).display === "none";
    this.updateCostumeDetailsVisibility(safeDomId, isHidden);
  },

  closeAllCostumeDetails() {
    let hasOpenDetails = false;

    document.querySelectorAll("#costumeList .costume-details").forEach(
      (detailsElement) => {
        const isOpen =
          !detailsElement.classList.contains("hidden") &&
          detailsElement.style.display !== "none";
        if (!isOpen) {
          return;
        }

        hasOpenDetails = true;
        const safeDomId = detailsElement.id.replace("costume-details-", "");
        this.updateCostumeDetailsVisibility(safeDomId, false);
      },
    );

    return hasOpenDetails;
  },

  async addNewCostume(characterName, safeDomId) {
    const costumeId = await modalService.prompt("请输入新的服装ID：");
    if (!costumeId || !costumeId.trim()) {
      return;
    }

    const trimmedCostumeId = costumeId.trim();
    if (
      this.ensureTempAvailableCostumes(characterName).includes(trimmedCostumeId)
    ) {
      ui.showStatus("该服装ID已存在", "error");
      return;
    }

    this.ensureTempAvailableCostumes(characterName).push(trimmedCostumeId);
    this.updateCostumeListUI(characterName, safeDomId);
    ui.showStatus(`已在临时列表添加服装: ${trimmedCostumeId}`, "info");
  },

  async editCostume(characterName, index, oldCostumeId, safeDomId) {
    const editedCostumeId = await modalService.prompt(
      "编辑服装ID：",
      oldCostumeId,
    );
    if (
      !editedCostumeId ||
      !editedCostumeId.trim() ||
      editedCostumeId === oldCostumeId
    ) {
      return;
    }

    const trimmedCostumeId = editedCostumeId.trim();
    if (
      this.ensureTempAvailableCostumes(characterName).includes(trimmedCostumeId)
    ) {
      ui.showStatus("该服装ID已存在", "error");
      return;
    }

    this.ensureTempAvailableCostumes(characterName)[index] = trimmedCostumeId;
    this.replaceSelectedCostume(characterName, oldCostumeId, trimmedCostumeId);

    this.updateCostumeListUI(characterName, safeDomId);
  },

  async deleteCostume(characterName, index, safeDomId) {
    const costumeIdToDelete = this.ensureTempAvailableCostumes(characterName)[index];
    const confirmed = await modalService.confirm(
      `确定要删除服装 "${costumeIdToDelete}" 吗？`,
    );
    if (!confirmed) {
      return;
    }

    this.ensureTempAvailableCostumes(characterName).splice(index, 1);
    this.replaceSelectedCostume(characterName, costumeIdToDelete);

    this.updateCostumeListUI(characterName, safeDomId);
  },
};
