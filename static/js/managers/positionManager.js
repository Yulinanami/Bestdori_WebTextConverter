// 管理 Live2D 的站位配置：自动站位/手动站位、渲染列表、保存到本地
import { DataUtils } from "@utils/DataUtils.js";
import { ui } from "@utils/uiUtils.js";
import { modalService } from "@services/ModalService.js";
import { FileUtils } from "@utils/FileUtils.js";
import { positionUI } from "@managers/position/positionUI.js";
import { positionStore } from "@managers/position/positionStore.js";

export const positionManager = {
  positions: ["leftOver", "leftInside", "center", "rightInside", "rightOver"],
  autoLayoutPositions: ["leftInside", "center", "rightInside"],
  positionNames: positionUI.positionNames,

  manualPositions: {},
  tempManualPositions: {},
  tempAutoPositionMode: true,
  autoPositionMode: true,

  // 初始化：读取本地配置，并绑定页面上相关输入控件
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

  // 根据是否启用“自动站位”，显示/隐藏手动配置区域
  toggleManualConfig() {
    const manualConfig = document.getElementById("manualPositionConfig");
    if (manualConfig) {
      manualConfig.classList.toggle("hidden", this.tempAutoPositionMode);
    }
  },

  // 渲染位置配置列表（每个角色一行）
  renderPositionList() {
    positionUI.renderPositionList(this);
  },

  // 保存当前页面上的临时配置到本地存储
  async savePositions() {
    await ui.withButtonLoading(
      "savePositionsBtn",
      async () => {
        this.autoPositionMode = this.tempAutoPositionMode;
        this.manualPositions = DataUtils.deepClone(this.tempManualPositions);
        await FileUtils.delay(300);
        positionStore.savePositionConfig(this);
        ui.showStatus("位置配置已保存！", "success");
      },
      "保存中...",
    );
  },

  // 重置为默认（启用自动站位；手动偏移清空）
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

  // 获取某角色的最终站位配置（自动模式会按登场顺序分配位置）
  getCharacterPositionConfig(characterName, appearanceOrder) {
    return positionStore.getCharacterPositionConfig(
      this,
      characterName,
      appearanceOrder,
    );
  },

  // 从导入的数据里恢复位置配置（用于“导入配置”）
  importPositions(positionConfig) {
    positionStore.importPositions(this, positionConfig);
  },
};
