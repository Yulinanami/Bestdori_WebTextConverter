// 位置渲染界面管理（拆分自原位置配置管理器）
import { modalService } from "@services/ModalService.js";
import { ui } from "@utils/uiUtils.js";
import { FileUtils } from "@utils/FileUtils.js";
import { state } from "@managers/stateManager.js";
import { renderAvatar } from "@utils/avatarUtils.js";

export const positionView = {
  manager: null,
  positionNames: null,

  // 初始化绑定事件监听
  init(manager) {
    this.manager = manager;
    this.positionNames = manager.positionNames;

    // 切换自动模式时刷新页面配置区
    document.getElementById("autoPositionCheckbox")?.addEventListener(
      "change",
      (changeEvent) => {
        if (!this.manager) return;
        this.manager.tempAutoPositionMode = changeEvent.target.checked;
        this.toggleManualConfig();
      },
    );

    // 点击保存按钮
    document
      .getElementById("savePositionsBtn")
      ?.addEventListener("click", () => this.savePositions());

    // 点击重置按钮
    document
      .getElementById("resetPositionsBtn")
      ?.addEventListener("click", () => this.resetPositions());

    const positionList = document.getElementById("positionList");
    if (positionList) {
      positionList.addEventListener("change", (changeEvent) => {
        if (!this.manager) return;
        // 修改位置下拉框时同步到临时数据
        if (changeEvent.target.classList.contains("position-select")) {
          const characterName = changeEvent.target.dataset.character;
          if (!this.manager.tempManualPositions[characterName]) {
            this.manager.tempManualPositions[characterName] = {
              position: "center",
              offset: 0,
            };
          }
          this.manager.tempManualPositions[characterName].position =
            changeEvent.target.value;
        }
      });

      positionList.addEventListener("input", (inputEvent) => {
        if (!this.manager) return;
        // 修改水平偏移数字框时同步到临时数据
        if (inputEvent.target.classList.contains("position-offset-input")) {
          const characterName = inputEvent.target.dataset.character;
          const offset = parseInt(inputEvent.target.value) || 0;
          if (!this.manager.tempManualPositions[characterName]) {
            this.manager.tempManualPositions[characterName] = {
              position: "center",
              offset: 0,
            };
          }
          this.manager.tempManualPositions[characterName].offset = offset;
        }
      });
    }
  },

  // 切换手动配置区域的折叠隐藏
  toggleManualConfig() {
    if (!this.manager) return;

    const autoCheckbox = document.getElementById("autoPositionCheckbox");
    if (autoCheckbox) {
      autoCheckbox.checked = this.manager.tempAutoPositionMode;
    }

    document
      .getElementById("manualPositionConfig")
      ?.classList.toggle("hidden", this.manager.tempAutoPositionMode);
  },

  // 渲染所有角色的位置编辑列表
  renderPositionList() {
    const positionList = document.getElementById("positionList");
    if (!positionList || !this.manager) {
      return;
    }

    const fragment = document.createDocumentFragment();
    const characters = Object.entries(state.currentConfig).sort(
      ([, idsA], [, idsB]) => {
        const idA = idsA?.[0] ?? Infinity;
        const idB = idsB?.[0] ?? Infinity;
        return idA - idB;
      },
    );

    characters.forEach(([characterName, ids]) => {
      if (!ids || ids.length === 0) {
        return;
      }

      const primaryId = ids[0];
      const positionConfig = this.manager.tempManualPositions[characterName] || {
        position: "center",
        offset: 0,
      };

      fragment.appendChild(
        this.createPositionItem(
          characterName,
          primaryId,
          positionConfig.position || "center",
          positionConfig.offset || 0,
        ),
      );
    });

    positionList.replaceChildren(fragment);
  },

  // 创建单行位置选项的 DOM 元素
  createPositionItem(
    characterName,
    primaryId,
    currentPosition,
    currentOffset,
  ) {
    const positionItem = document
      .getElementById("position-item-template")
      .content.firstElementChild.cloneNode(true);
    const avatar = positionItem.querySelector(".config-avatar");
    avatar.dataset.id = primaryId;
    renderAvatar(avatar, primaryId, characterName);
    positionItem.querySelector(".position-character-name").textContent =
      `${characterName} (ID: ${primaryId})`;

    const positionSelect = positionItem.querySelector(".position-select");
    positionSelect.dataset.character = characterName;
    Object.entries(this.positionNames).forEach(([value, name]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = name;
      option.selected = value === currentPosition;
      positionSelect.appendChild(option);
    });

    const offsetInput = positionItem.querySelector(".position-offset-input");
    offsetInput.id = `offset-${characterName}`;
    offsetInput.dataset.character = characterName;
    offsetInput.value = currentOffset;
    positionItem.querySelector(".position-offset-label").htmlFor =
      offsetInput.id;
    return positionItem;
  },

  // 保存按钮的 UI 联动与等待状态
  async savePositions() {
    if (!this.manager) return;
    await ui.withButtonLoading(
      "savePositionsBtn",
      async () => {
        await this.manager.savePositionsData();
        await FileUtils.delay(300);
        ui.showStatus("位置配置已保存！", "success");
      },
      "保存中...",
    );
  },

  // 恢复默认按钮 of UI 联动与等待状态
  async resetPositions() {
    if (!this.manager) return;
    const confirmed = await modalService.confirm(
      "确定要将所有角色的位置恢复为默认（中间）并清除偏移吗？",
    );
    if (confirmed) {
      await ui.withButtonLoading(
        "resetPositionsBtn",
        async () => {
          this.manager.tempAutoPositionMode = true;
          this.manager.tempManualPositions = {};
          this.renderPositionList();

          const autoCheckbox = document.getElementById("autoPositionCheckbox");
          if (autoCheckbox) {
            autoCheckbox.checked = true;
          }

          this.toggleManualConfig();
          await FileUtils.delay(300);
          ui.showStatus("已在编辑器中恢复默认，请保存以生效", "info");
        },
        "重置中...",
      );
    }
  },
};
