// 位置配置
import { DataUtils } from "@utils/DataUtils.js";
import { DOMUtils } from "@utils/DOMUtils.js";
import { ui } from "@utils/uiUtils.js";
import { modalService } from "@services/ModalService.js";
import { FileUtils } from "@utils/FileUtils.js";
import { state } from "@managers/stateManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { renderCharacterAvatar } from "@utils/avatarUtils.js";

const POSITION_NAMES = {
  leftOver: "左外",
  leftInside: "左内",
  center: "中间",
  rightInside: "右内",
  rightOver: "右外",
};

export const positionManager = {
  autoLayoutPositions: ["leftInside", "center", "rightInside"],
  positionNames: POSITION_NAMES,

  manualPositions: {},
  tempManualPositions: {},
  tempAutoPositionMode: true,
  autoPositionMode: true,

  // 初始化位置页
  init() {
    this.loadPositionConfig();
    const autoCheckbox = document.getElementById("autoPositionCheckbox");
    if (autoCheckbox) {
      // 切换自动模式时刷新页面
      autoCheckbox.addEventListener("change", (changeEvent) => {
        this.tempAutoPositionMode = changeEvent.target.checked;
        this.toggleManualConfig();
      });
    }
    const saveButton = document.getElementById("savePositionsBtn");
    if (saveButton) {
      // 点保存时保存位置
      saveButton.addEventListener("click", () => this.savePositions());
    }
    const resetButton = document.getElementById("resetPositionsBtn");
    if (resetButton) {
      // 点重置时恢复默认
      resetButton.addEventListener("click", () => this.resetPositions());
    }
    const positionList = document.getElementById("positionList");
    if (positionList) {
      positionList.addEventListener("change", (changeEvent) => {
        // 改位置时写到临时数据
        if (changeEvent.target.classList.contains("position-select")) {
          const characterName = changeEvent.target.dataset.character;
          if (!this.tempManualPositions[characterName]) {
            this.tempManualPositions[characterName] = {
              position: "center",
              offset: 0,
            };
          }
          this.tempManualPositions[characterName].position =
            changeEvent.target.value;
        }
      });
      positionList.addEventListener("input", (inputEvent) => {
        // 改偏移时写到临时数据
        if (inputEvent.target.classList.contains("position-offset-input")) {
          const characterName = inputEvent.target.dataset.character;
          const offset = parseInt(inputEvent.target.value) || 0;
          if (!this.tempManualPositions[characterName]) {
            this.tempManualPositions[characterName] = {
              position: "center",
              offset: 0,
            };
          }
          this.tempManualPositions[characterName].offset = offset;
        }
      });
    }
  },

  // 切换手动配置区域显示
  toggleManualConfig() {
    const manualConfig = document.getElementById("manualPositionConfig");
    if (manualConfig) {
      manualConfig.classList.toggle("hidden", this.tempAutoPositionMode);
    }
  },

  // 进入页面前准备临时数据
  prepareStep() {
    this.tempAutoPositionMode = this.autoPositionMode;
    this.tempManualPositions = DataUtils.deepClone(this.manualPositions);
    document.getElementById("autoPositionCheckbox").checked =
      this.tempAutoPositionMode;
    this.renderPositionList();
    this.toggleManualConfig();
  },

  // 保存位置配置
  async savePositions() {
    await ui.withButtonLoading(
      "savePositionsBtn",
      async () => {
        this.autoPositionMode = this.tempAutoPositionMode;
        this.manualPositions = DataUtils.deepClone(this.tempManualPositions);
        await FileUtils.delay(300);
        this.savePositionConfig();
        ui.showStatus("位置配置已保存！", "success");
      },
      "保存中...",
    );
  },

  // 恢复默认位置
  async resetPositions() {
    const confirmed = await modalService.confirm(
      "确定要将所有角色的位置恢复为默认（中间）并清除偏移吗？",
    );
    if (confirmed) {
      await ui.withButtonLoading(
        "resetPositionsBtn",
        async () => {
          this.tempAutoPositionMode = true;
          this.tempManualPositions = {};
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

  // 读取本地位置配置
  loadPositionConfig() {
    const config = storageService.load(STORAGE_KEYS.POSITION_CONFIG);
    if (!config) {
      return;
    }

    this.autoPositionMode = config.autoPositionMode !== false;
    this.manualPositions = config.manualPositions || {};
  },

  // 保存本地位置配置
  savePositionConfig() {
    const config = {
      autoPositionMode: this.autoPositionMode,
      manualPositions: this.manualPositions,
    };
    return storageService.save(STORAGE_KEYS.POSITION_CONFIG, config);
  },

  // 导入位置配置
  importPositions(positionConfig) {
    if (!positionConfig) {
      return;
    }

    if (typeof positionConfig.autoPositionMode === "boolean") {
      this.autoPositionMode = positionConfig.autoPositionMode;
    }
    if (positionConfig.manualPositions) {
      this.manualPositions = positionConfig.manualPositions;
    }

    this.savePositionConfig();
  },

  // 读取角色位置
  resolveCharacterPositionConfig(characterName, appearanceOrder) {
    if (this.autoPositionMode) {
      return {
        position:
          this.autoLayoutPositions[
            appearanceOrder % this.autoLayoutPositions.length
          ],
        offset: 0,
      };
    }

    const config = this.manualPositions[characterName] || {
      position: "center",
      offset: 0,
    };
    return {
      position: config.position || "center",
      offset: config.offset || 0,
    };
  },

  // 创建一项位置配置
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
    renderCharacterAvatar(avatarDiv, primaryId, characterName);
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
    controlsDiv.appendChild(positionSelect);

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

  renderPositionList() {
    const positionList = document.getElementById("positionList");
    if (!positionList) {
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
      const positionConfig = this.tempManualPositions[characterName] || {
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

};
