// Live2D 位置管理功能
import { DataUtils } from "./utils/DataUtils.js";
import { DOMUtils } from "./utils/DOMUtils.js";
import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";
import { storageService, STORAGE_KEYS } from "./services/StorageService.js";
import { modalService } from "./services/ModalService.js";
import { eventBus, EVENTS } from "./services/EventBus.js";

export const positionManager = {
  positions: ["leftOver", "leftInside", "center", "rightInside", "rightOver"],
  // 快速布局时使用的位置循环顺序（左内 → 中间 → 右内）
  autoLayoutPositions: ["leftInside", "center", "rightInside"],
  positionNames: {
    leftOver: "左外",
    leftInside: "左内",
    center: "中间",
    rightInside: "右内",
    rightOver: "右外",
  },
  
  manualPositions: {},
  positionCounter: 0,
  tempManualPositions: {},
  tempAutoPositionMode: true,

  // 初始化
  init() {
    this.loadPositionConfig();
    const autoCheckbox = document.getElementById("autoPositionCheckbox");
    if (autoCheckbox) {
      autoCheckbox.addEventListener("change", (e) => {
        this.tempAutoPositionMode = e.target.checked;
        this.toggleManualConfig();
      });
    }
    const saveBtn = document.getElementById("savePositionsBtn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => this.savePositions());
    }
    const resetBtn = document.getElementById("resetPositionsBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.resetPositions());
    }
    const positionList = document.getElementById("positionList");
    if (positionList) {
      positionList.addEventListener("change", (e) => {
        if (e.target.classList.contains("position-select")) {
          const charName = e.target.dataset.character;
          if (!this.tempManualPositions[charName]) {
            this.tempManualPositions[charName] = {
              position: "center",
              offset: 0,
            };
          }
          this.tempManualPositions[charName].position = e.target.value;
        }
      });
      positionList.addEventListener("input", (e) => {
        if (e.target.classList.contains("position-offset-input")) {
          const charName = e.target.dataset.character;
          const offset = parseInt(e.target.value) || 0;
          if (!this.tempManualPositions[charName]) {
            this.tempManualPositions[charName] = {
              position: "center",
              offset: 0,
            };
          }
          this.tempManualPositions[charName].offset = offset;
        }
      });
    }
  },

  // 加载配置
  loadPositionConfig() {
    const config = storageService.get(STORAGE_KEYS.POSITION_CONFIG);
    if (config) {
      this.autoPositionMode = config.autoPositionMode !== false;
      this.manualPositions = config.manualPositions || {};
    }
  },

  // 保存配置
  savePositionConfig() {
    const config = {
      autoPositionMode: this.autoPositionMode,
      manualPositions: this.manualPositions,
    };
    return storageService.set(STORAGE_KEYS.POSITION_CONFIG, config);
  },

  // 切换手动配置显示
  toggleManualConfig() {
    const manualConfig = document.getElementById("manualPositionConfig");
    if (manualConfig) {
      manualConfig.style.display = this.tempAutoPositionMode ? "none" : "block";
    }
  },

  /**
   * 创建位置配置项元素
   * @private
   * @param {string} name - 角色名称
   * @param {number} primaryId - 主要角色ID
   * @param {number} avatarId - 头像ID
   * @param {string} avatarPath - 头像路径
   * @param {string} currentPosition - 当前位置
   * @param {number} currentOffset - 当前偏移值
   * @returns {HTMLElement} 位置配置项DOM元素
   */
  _createPositionItem(
    name,
    primaryId,
    avatarId,
    avatarPath,
    currentPosition,
    currentOffset
  ) {
    // 创建主容器
    const item = DOMUtils.createElement("div", {
      class: "position-config-item",
    });

    // 创建角色信息区域
    const infoDiv = this._createCharacterInfo(
      name,
      primaryId,
      avatarId,
      avatarPath
    );

    // 创建控制区域
    const controlsDiv = this._createPositionControls(
      name,
      currentPosition,
      currentOffset
    );

    // 组装完整项目
    DOMUtils.appendChildren(item, [infoDiv, controlsDiv]);

    return item;
  },

  /**
   * 创建角色信息区域
   * @private
   */
  _createCharacterInfo(name, primaryId, avatarId, avatarPath) {
    const infoDiv = DOMUtils.createElement("div", {
      class: "position-character-info",
    });

    // 创建头像区域
    const avatarWrapper = DOMUtils.createElement("div", {
      class: "config-avatar-wrapper",
    });

    const avatarDiv = DOMUtils.createElement("div", {
      class: "config-avatar",
      "data-id": primaryId,
    });

    // 创建头像内容
    if (avatarId > 0) {
      const img = DOMUtils.createElement("img", {
        src: avatarPath,
        alt: name,
        class: "config-avatar-img",
      });

      // 设置图片加载失败的回退处理
      img.addEventListener("error", function () {
        this.style.display = "none";
        this.parentElement.textContent = name.charAt(0);
        this.parentElement.classList.add("fallback");
      });

      avatarDiv.appendChild(img);
    } else {
      // 没有头像时显示首字母
      avatarDiv.textContent = name.charAt(0);
      avatarDiv.classList.add("fallback");
    }

    avatarWrapper.appendChild(avatarDiv);
    infoDiv.appendChild(avatarWrapper);

    // 创建角色名称标签
    const nameSpan = DOMUtils.createElement("span", {
      class: "position-character-name",
    });
    nameSpan.textContent = `${name} (ID: ${primaryId})`;
    infoDiv.appendChild(nameSpan);

    return infoDiv;
  },

  /**
   * 创建位置控制区域
   * @private
   */
  _createPositionControls(name, currentPosition, currentOffset) {
    const controlsDiv = DOMUtils.createElement("div", {
      class: "position-controls",
    });

    // 创建位置选择器
    const select = DOMUtils.createElement("select", {
      class: "form-input position-select",
      "data-character": name,
    });

    // 添加位置选项
    this.positions.forEach((pos) => {
      const option = DOMUtils.createElement("option", { value: pos });
      option.textContent = this.positionNames[pos];
      if (pos === currentPosition) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    controlsDiv.appendChild(select);

    // 创建偏移输入组
    const offsetGroup = this._createOffsetInputGroup(name, currentOffset);
    controlsDiv.appendChild(offsetGroup);

    return controlsDiv;
  },

  /**
   * 创建偏移输入组
   * @private
   */
  _createOffsetInputGroup(name, currentOffset) {
    const offsetGroup = DOMUtils.createElement("div", {
      class: "position-offset-group",
    });

    // 创建标签
    const label = DOMUtils.createElement("label", {
      class: "position-offset-label",
      for: `offset-${name}`,
    });
    label.textContent = "偏移:";

    // 创建输入框
    const input = DOMUtils.createElement("input", {
      type: "number",
      id: `offset-${name}`,
      class: "form-input position-offset-input",
      "data-character": name,
      value: currentOffset,
      step: "10",
      placeholder: "0",
      title: "设置水平偏移量，正值向右，负值向左",
    });

    // 创建单位提示
    const hint = DOMUtils.createElement("span", {
      class: "position-offset-hint",
    });
    hint.textContent = "px";

    // 组装偏移输入组
    DOMUtils.appendChildren(offsetGroup, [label, input, hint]);

    return offsetGroup;
  },

  // 渲染位置列表
  renderPositionList() {
    const positionList = document.getElementById("positionList");
    if (!positionList) return;
    const fragment = document.createDocumentFragment();
    const characters = Object.entries(state.get("currentConfig")).sort(
      ([, idsA], [, idsB]) => {
        const idA = idsA && idsA.length > 0 ? idsA[0] : Infinity;
        const idB = idsB && idsB.length > 0 ? idsB[0] : Infinity;
        return idA - idB;
      }
    );
    characters.forEach(([name, ids]) => {
      if (!ids || ids.length === 0) return;
      const primaryId = ids[0];
      const avatarId = configManager.getAvatarId(primaryId);
      const avatarPath =
        avatarId > 0 ? `/static/images/avatars/${avatarId}.png` : "";
      const currentConfig = this.tempManualPositions[name] || {
        position: "center",
        offset: 0,
      };
      const currentPosition = currentConfig.position || "center";
      const currentOffset = currentConfig.offset || 0;

      const item = this._createPositionItem(
        name,
        primaryId,
        avatarId,
        avatarPath,
        currentPosition,
        currentOffset
      );
      fragment.appendChild(item);
    });
    DOMUtils.clearElement(positionList);
    positionList.appendChild(fragment);
  },

  // 保存位置配置
  async savePositions() {
    await ui.withButtonLoading(
      "savePositionsBtn",
      async () => {
        this.autoPositionMode = this.tempAutoPositionMode;
        this.manualPositions = DataUtils.deepClone(this.tempManualPositions);
        await new Promise((resolve) => setTimeout(resolve, 300));
        this.savePositionConfig();
        ui.showStatus("位置配置已保存！", "success");
        eventBus.emit(EVENTS.POSITION_SAVED, {
          autoPositionMode: this.autoPositionMode,
          manualPositions: this.manualPositions,
        });
      },
      "保存中..."
    );
  },

  // 重置为默认位置（全部设为中间，偏移清零）
  async resetPositions() {
    const confirmed = await modalService.confirm(
      "确定要将所有角色的位置恢复为默认（中间）并清除偏移吗？"
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
          await new Promise((resolve) => setTimeout(resolve, 300));
          ui.showStatus("已在编辑器中恢复默认，请保存以生效", "info");
        },
        "重置中..."
      );
    }
  },

  // 获取角色的位置和偏移
  getCharacterPositionConfig(characterName, appearanceOrder) {
    if (this.autoPositionMode) {
      return {
        position: this.autoLayoutPositions[appearanceOrder % this.autoLayoutPositions.length],
        offset: 0,
      };
    } else {
      const config = this.manualPositions[characterName] || {
        position: "center",
        offset: 0,
      };
      return {
        position: config.position || "center",
        offset: config.offset || 0,
      };
    }
  },

  // 导入位置配置
  importPositions(positionConfig) {
    if (!positionConfig) return;
    if (typeof positionConfig.autoPositionMode === "boolean") {
      this.autoPositionMode = positionConfig.autoPositionMode;
    }
    if (positionConfig.manualPositions) {
      this.manualPositions = positionConfig.manualPositions;
    }
    this.savePositionConfig();
  },
};
