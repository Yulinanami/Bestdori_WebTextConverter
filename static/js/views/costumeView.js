// 服装渲染界面管理（拆分自原服装配置管理器）
import { modalService } from "@services/ModalService.js";
import { ui } from "@utils/uiUtils.js";
import { state } from "@managers/stateManager.js";
import { FileUtils } from "@utils/FileUtils.js";
import { renderAvatar } from "@utils/avatarUtils.js";
import { DataUtils } from "@utils/DataUtils.js";

export const costumeView = {
  manager: null,
  escCloseBound: false,

  // 初始化绑定事件
  init(manager) {
    this.manager = manager;
    this.bindListEvents();
    this.bindActionButtons();
    this.bindEscCloseDetails();
  },

  // 绑定动作按钮
  bindActionButtons() {
    [
      ["saveCostumesBtn", () => this.saveCostumes()],
      ["resetCostumesBtn", () => this.resetCostumes()],
    ].forEach(([buttonId, handler]) => {
      document.getElementById(buttonId)?.addEventListener("click", handler);
    });
  },

  // 绑定服装列表监听
  bindListEvents() {
    const costumeList = document.getElementById("costumeList");
    if (!costumeList) return;
    costumeList.addEventListener("click", (clickEvent) => this.handleListClick(clickEvent));
    costumeList.addEventListener("change", (changeEvent) => this.handleListChange(changeEvent));
  },

  // 列表操作分发
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

  // 下拉菜单变动
  handleListChange(changeEvent) {
    const select = changeEvent.target.closest(".costume-select");
    if (!select || !this.manager) {
      return;
    }
    this.manager.tempCostumeChanges[select.dataset.characterName] = select.value;
  },

  // Esc 键盘关闭监听
  bindEscCloseDetails() {
    if (this.escCloseBound) return;
    this.escCloseBound = true;

    document.addEventListener("keydown", (keyboardEvent) => {
      if (keyboardEvent.key === "Escape" && this.closeCostumeDetails()) {
        keyboardEvent.preventDefault();
      }
    });
  },

  // 渲染一个下拉框
  renderCostumeSelect(costumeSelect, availableCostumes, selectedCostumeId = "") {
    costumeSelect.replaceChildren(new Option("无服装", ""));
    availableCostumes.forEach((costumeId) => {
      costumeSelect.add(new Option(costumeId, costumeId));
    });
    costumeSelect.value = selectedCostumeId;
  },

  // 渲染整个列表
  renderCostumeList(manager) {
    this.manager = manager || this.manager;
    const costumeList = document.getElementById("costumeList");
    const template = document.getElementById("costume-item-template");
    if (!costumeList || !template || !this.manager) return;

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
      const characterCostumes =
        this.manager.draftCostumes[characterName] || [];
      const selectedCostumeId = this.manager.tempCostumeChanges[characterName] || "";

      renderAvatar(
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
        characterCostumes,
        selectedCostumeId,
      );

      const addButton = costumeItem.querySelector(".add-costume-btn");
      addButton.dataset.characterName = characterName;
      addButton.dataset.safeDomId = safeDomId;

      const listItems = costumeItem.querySelector(".costume-list-items");
      listItems.id = `costume-list-${safeDomId}`;
      listItems.innerHTML = this.renderCostumeItems(
        characterName,
        characterCostumes,
        safeDomId,
      );

      fragment.appendChild(costumeItem);
    });

    costumeList.replaceChildren();
    costumeList.appendChild(fragment);
  },

  // 渲染每行列表项
  renderCostumeItems(characterName, availableCostumeIds, safeDomId) {
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

  // 局部重刷一行的 UI
  updateCostumeListUI(characterName, safeDomId) {
    if (!this.manager) return;
    const characterCostumes =
      this.manager.draftCostumes[characterName] || [];
    const selectedCostumeId = this.manager.tempCostumeChanges[characterName] || "";
    const detailsContainer = document.getElementById(`costume-details-${safeDomId}`);
    const listContainer = document.getElementById(`costume-list-${safeDomId}`);
    if (!detailsContainer || !listContainer) return;

    const costumeSelect = detailsContainer.querySelector(".costume-select");

    listContainer.innerHTML = this.renderCostumeItems(
      characterName,
      characterCostumes,
      safeDomId,
    );

    this.renderCostumeSelect(
      costumeSelect,
      characterCostumes,
      selectedCostumeId,
    );
  },

  // 展开与收起的折叠切换
  syncCostumeDetails(safeDomId, visible) {
    const details = document.getElementById(`costume-details-${safeDomId}`);
    const toggle = document.getElementById(`toggle-${safeDomId}`);
    if (!details || !toggle) return;
    details.classList.toggle("hidden", !visible);
    details.style.display = visible ? "block" : "none";
    toggle.textContent = visible ? "expand_less" : "expand_more";
  },

  // 触发展开状态
  toggleCostumeDetails(safeDomId) {
    const details = document.getElementById(`costume-details-${safeDomId}`);
    if (!details) return;
    const isHidden =
      details.classList.contains("hidden") ||
      details.style.display === "none" ||
      window.getComputedStyle(details).display === "none";
    this.syncCostumeDetails(safeDomId, isHidden);
  },

  // 关闭展开的服装卡片
  closeCostumeDetails() {
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
        this.syncCostumeDetails(safeDomId, false);
      },
    );

    return hasOpenDetails;
  },

  // 页面上添加服装
  async addNewCostume(characterName, safeDomId) {
    if (!this.manager) return;
    const costumeId = await modalService.prompt("请输入新的服装ID：");
    if (!costumeId || !costumeId.trim()) {
      return;
    }

    const trimmedCostumeId = costumeId.trim();
    if (
      this.manager.ensureTempCostumes(characterName).includes(trimmedCostumeId)
    ) {
      ui.showStatus("该服装ID已存在", "error");
      return;
    }

    this.manager.ensureTempCostumes(characterName).push(trimmedCostumeId);
    this.updateCostumeListUI(characterName, safeDomId);
    ui.showStatus(`已在临时列表添加服装: ${trimmedCostumeId}`, "info");
  },

  // 页面上编辑服装
  async editCostume(characterName, index, oldCostumeId, safeDomId) {
    if (!this.manager) return;
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
      this.manager.ensureTempCostumes(characterName).includes(trimmedCostumeId)
    ) {
      ui.showStatus("该服装ID已存在", "error");
      return;
    }

    this.manager.ensureTempCostumes(characterName)[index] = trimmedCostumeId;
    this.manager.replaceCostume(characterName, oldCostumeId, trimmedCostumeId);

    this.updateCostumeListUI(characterName, safeDomId);
  },

  // 页面上删除服装
  async deleteCostume(characterName, index, safeDomId) {
    if (!this.manager) return;
    const costumeIdToDelete = this.manager.ensureTempCostumes(characterName)[index];
    const confirmed = await modalService.confirm(
      `确定要删除服装 "${costumeIdToDelete}" 吗？`,
    );
    if (!confirmed) {
      return;
    }

    this.manager.ensureTempCostumes(characterName).splice(index, 1);
    this.manager.replaceCostume(characterName, costumeIdToDelete);

    this.updateCostumeListUI(characterName, safeDomId);
  },

  // 保存服装
  async saveCostumes() {
    if (!this.manager) return;
    await ui.withButtonLoading(
      "saveCostumesBtn",
      async () => {
        await this.manager.saveCostumesData();
        await FileUtils.delay(300);
        ui.showStatus("服装配置已保存！", "success");
      },
      "保存中...",
    );
  },

  // 恢复服装默认值
  async resetCostumes() {
    if (!this.manager) return;
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
          customCostumes,
          customOptions,
        } = this.manager.collectCustoms();

        this.manager.tempCostumeChanges = {
          ...this.manager.mapDefaultCostumes(),
          ...customCostumes,
        };
        this.manager.draftCostumes = {
          ...this.manager.mapCostumes(),
          ...customOptions,
        };
        this.renderCostumeList();
        ui.showStatus("已在编辑器中恢复默认，请保存以生效", "info");
      },
      "恢复中...",
    );
  },
};
