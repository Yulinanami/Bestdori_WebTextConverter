// 位置渲染界面管理（拆分自原位置配置管理器）
import { DOMUtils } from "@utils/DOMUtils.js";
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

    DOMUtils.clearElement(positionList);
    positionList.appendChild(fragment);
  },

  // 创建单行位置选项的 DOM 元素
  createPositionItem(
    characterName,
    primaryId,
    currentPosition,
    currentOffset,
  ) {
    const positionItem = DOMUtils.createElement("div", {
      class: "position-config-item",
    });

    const infoDiv = DOMUtils.createElement("div", {
      class: "position-character-info",
    });
    const avatarWrapper = DOMUtils.createElement("div", {
      class: "config-avatar-wrapper",
    });
    const avatarDiv = DOMUtils.createElement("div", {
      class: "config-avatar",
      "data-id": primaryId,
    });
    renderAvatar(avatarDiv, primaryId, characterName);
    avatarWrapper.appendChild(avatarDiv);
    infoDiv.appendChild(avatarWrapper);

    const nameSpan = DOMUtils.createElement("span", {
      class: "position-character-name",
    });
    nameSpan.textContent = `${characterName} (ID: ${primaryId})`;
    infoDiv.appendChild(nameSpan);

    const controlsDiv = DOMUtils.createElement("div", {
      class: "position-controls",
    });
    const positionSelectWrap = DOMUtils.createElement("div", {
      class: "select-with-icon",
    });
    const positionSelect = DOMUtils.createElement("select", {
      class: "form-input position-select",
      "data-character": characterName,
    });
    Object.entries(this.positionNames).forEach(([value, name]) => {
      const option = DOMUtils.createElement("option", { value });
      option.textContent = name;
      if (value === currentPosition) {
        option.selected = true;
      }
      positionSelect.appendChild(option);
    });
    const positionSelectIcon = DOMUtils.createElement("span", {
      class: "material-symbols-outlined",
      "aria-hidden": "true",
    });
    DOMUtils.appendChildren(positionSelectWrap, [
      positionSelect,
      positionSelectIcon,
    ]);
    controlsDiv.appendChild(positionSelectWrap);

    const offsetGroup = DOMUtils.createElement("div", {
      class: "position-offset-group",
    });
    const offsetLabel = DOMUtils.createElement("label", {
      class: "position-offset-label",
      for: `offset-${characterName}`,
    });
    offsetLabel.textContent = "偏移:";
    const offsetInput = DOMUtils.createElement("input", {
      type: "number",
      id: `offset-${characterName}`,
      class: "form-input position-offset-input",
      "data-character": characterName,
      value: currentOffset,
      step: "10",
      placeholder: "0",
      title: "设置水平偏移量，正值向右，负值向左",
    });
    const offsetHint = DOMUtils.createElement("span", {
      class: "position-offset-hint",
    });
    offsetHint.textContent = "px";
    DOMUtils.appendChildren(offsetGroup, [
      offsetLabel,
      offsetInput,
      offsetHint,
    ]);
    controlsDiv.appendChild(offsetGroup);

    DOMUtils.appendChildren(positionItem, [infoDiv, controlsDiv]);
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
