// Live2D 位置管理功能
import { DataUtils } from "../utils/DataUtils.js";
import { ui } from "../utils/uiUtils.js";
import { modalService } from "../services/ModalService.js";
import { positionUI } from "./position/positionUI.js";
import { positionStore } from "./position/positionStore.js";

export const positionManager = {
  positions: ["leftOver", "leftInside", "center", "rightInside", "rightOver"],
  autoLayoutPositions: ["leftInside", "center", "rightInside"],
  positionNames: positionUI.positionNames,

  manualPositions: {},
  positionCounter: 0,
  tempManualPositions: {},
  tempAutoPositionMode: true,
  autoPositionMode: true,

  init() {
    positionStore.loadPositionConfig(this);
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

  toggleManualConfig() {
    const manualConfig = document.getElementById("manualPositionConfig");
    if (manualConfig) {
      manualConfig.style.display = this.tempAutoPositionMode ? "none" : "block";
    }
  },

  renderPositionList() {
    positionUI.renderPositionList(this);
  },

  // 保存位置配置
  async savePositions() {
    await ui.withButtonLoading(
      "savePositionsBtn",
      async () => {
        this.autoPositionMode = this.tempAutoPositionMode;
        this.manualPositions = DataUtils.deepClone(this.tempManualPositions);
        await new Promise((resolve) => setTimeout(resolve, 300));
        positionStore.savePositionConfig(this);
        ui.showStatus("位置配置已保存！", "success");
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

  getCharacterPositionConfig(characterName, appearanceOrder) {
    return positionStore.getCharacterPositionConfig(
      this,
      characterName,
      appearanceOrder
    );
  },

  importPositions(positionConfig) {
    positionStore.importPositions(this, positionConfig);
  },
};
