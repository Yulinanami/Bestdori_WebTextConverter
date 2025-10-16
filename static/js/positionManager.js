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
  positions: ["leftInside", "center", "rightInside"],
  positionNames: {
    leftInside: "左侧",
    center: "中间",
    rightInside: "右侧",
  },
  autoPositionMode: true,
  manualPositions: {},
  positionCounter: 0,
  tempManualPositions: {},
  tempAutoPositionMode: true,

  // 初始化
  init() {
    // 注册特殊的模态框关闭处理器
    modalService.registerCloseHandler("positionModal", () => {
      this.closePositionModal();
    });

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

  // 打开位置配置模态框
  async openPositionModal() {
    await ui.withButtonLoading(
      "positionConfigBtn",
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        this.tempAutoPositionMode = this.autoPositionMode;
        this.tempManualPositions = DataUtils.deepClone(this.manualPositions);
        const autoCheckbox = document.getElementById("autoPositionCheckbox");
        if (autoCheckbox) {
          autoCheckbox.checked = this.tempAutoPositionMode;
        }
        this.renderPositionList();
        this.toggleManualConfig();
        modalService.open("positionModal");
      },
      "加载中..."
    );
  },

  // 关闭模态框
  closePositionModal() {
    modalService.close("positionModal");
  },

  // 切换手动配置显示
  toggleManualConfig() {
    const manualConfig = document.getElementById("manualPositionConfig");
    if (manualConfig) {
      manualConfig.style.display = this.tempAutoPositionMode ? "none" : "block";
    }
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
      const item = document.createElement("div");
      item.className = "position-config-item";
      item.innerHTML = `
                <div class="position-character-info">
                    <div class="config-avatar-wrapper">
                        <div class="config-avatar" data-id="${primaryId}">
                            ${
                              avatarId > 0
                                ? `<img src="${avatarPath}" alt="${name}" class="config-avatar-img" onerror="this.style.display='none'; this.parentElement.innerHTML='${name.charAt(
                                    0
                                  )}'; this.parentElement.classList.add('fallback');">`
                                : name.charAt(0)
                            }
                        </div>
                    </div>
                    <span class="position-character-name">${name} (ID: ${primaryId})</span>
                </div>
                <div class="position-controls">
                    <select class="form-input position-select" data-character="${name}">
                        ${this.positions
                          .map(
                            (pos) =>
                              `<option value="${pos}" ${
                                pos === currentPosition ? "selected" : ""
                              }>${this.positionNames[pos]}</option>`
                          )
                          .join("")}
                    </select>
                    <div class="position-offset-group">
                        <label class="position-offset-label" for="offset-${name}">偏移:</label>
                        <input type="number"
                            id="offset-${name}"
                            class="form-input position-offset-input"
                            data-character="${name}"
                            value="${currentOffset}"
                            step="10"
                            placeholder="0"
                            title="设置水平偏移量，正值向右，负值向左">
                        <span class="position-offset-hint">px</span>
                    </div>
                </div>
            `;
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
        this.closePositionModal();
        eventBus.emit(EVENTS.POSITION_SAVED, { autoPositionMode: this.autoPositionMode, manualPositions: this.manualPositions });
      },
      "保存中..."
    );
  },

  // 重置为默认位置（全部设为中间，偏移清零）
  async resetPositions() {
    const confirmed = await modalService.confirm("确定要将所有角色的位置恢复为默认（中间）并清除偏移吗？");
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
        position: this.positions[appearanceOrder % this.positions.length],
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
    console.log("位置配置已导入:", {
      autoMode: this.autoPositionMode,
      manualPositions: this.manualPositions,
    });
  },

  // 重置位置计数器
  resetPositionCounter() {
    this.positionCounter = 0;
  },
};
