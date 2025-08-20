// Live2D 位置管理功能
import { state } from "./constants.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";

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

  // 初始化
  init() {
    this.loadPositionConfig();
    const autoCheckbox = document.getElementById("autoPositionCheckbox");
    if (autoCheckbox) {
      autoCheckbox.addEventListener("change", (e) => {
        this.autoPositionMode = e.target.checked;
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
  },

  // 加载配置
  loadPositionConfig() {
    const saved = localStorage.getItem("bestdori_position_config");
    if (saved) {
      try {
        const config = JSON.parse(saved);
        this.autoPositionMode = config.autoPositionMode !== false;
        this.manualPositions = config.manualPositions || {};
        this.ensurePositionFormat();
      } catch (e) {
        console.error("加载位置配置失败:", e);
      }
    }
  },

  // 确保位置配置格式正确（兼容旧版本）
  ensurePositionFormat() {
    const updatedPositions = {};
    for (const [name, value] of Object.entries(this.manualPositions)) {
      if (typeof value === "string") {
        updatedPositions[name] = {
          position: value,
          offset: 0,
        };
      } else {
        updatedPositions[name] = {
          position: value.position || "center",
          offset: value.offset || 0,
        };
      }
    }
    this.manualPositions = updatedPositions;
  },

  // 保存配置
  savePositionConfig() {
    const config = {
      autoPositionMode: this.autoPositionMode,
      manualPositions: this.manualPositions,
    };
    localStorage.setItem("bestdori_position_config", JSON.stringify(config));
  },

  // 打开位置配置模态框
  openPositionModal() {
    const autoCheckbox = document.getElementById("autoPositionCheckbox");
    if (autoCheckbox) {
      autoCheckbox.checked = this.autoPositionMode;
    }
    this.renderPositionList();
    this.toggleManualConfig();
    ui.openModal("positionModal");
  },

  // 关闭模态框
  closePositionModal() {
    ui.closeModal("positionModal");
  },

  // 切换手动配置显示
  toggleManualConfig() {
    const manualConfig = document.getElementById("manualPositionConfig");
    if (manualConfig) {
      manualConfig.style.display = this.autoPositionMode ? "none" : "block";
    }
  },

  // 渲染位置列表
  renderPositionList() {
    const positionList = document.getElementById("positionList");
    if (!positionList) return;
    positionList.innerHTML = "";
    const characters = Object.entries(state.currentConfig).sort(
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
      const currentConfig = this.manualPositions[name] || {
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
      const select = item.querySelector(".position-select");
      select.addEventListener("change", (e) => {
        const charName = e.target.dataset.character;
        if (!this.manualPositions[charName]) {
          this.manualPositions[charName] = { position: "center", offset: 0 };
        }
        this.manualPositions[charName].position = e.target.value;
      });
      const offsetInput = item.querySelector(".position-offset-input");
      offsetInput.addEventListener("input", (e) => {
        const charName = e.target.dataset.character;
        const offset = parseInt(e.target.value) || 0;
        if (!this.manualPositions[charName]) {
          this.manualPositions[charName] = { position: "center", offset: 0 };
        }
        this.manualPositions[charName].offset = offset;
      });
      positionList.appendChild(item);
    });
  },

  // 保存位置配置
  async savePositions() {
    await ui.withButtonLoading(
      "savePositionsBtn",
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        this.savePositionConfig();
        ui.showStatus("位置配置已保存！", "success");
        this.closePositionModal();
      },
      "保存中..."
    );
  },

  // 重置为默认位置（全部设为中间，偏移清零）
  async resetPositions() {
    if (confirm("确定要将所有角色的位置恢复为默认（中间）并清除偏移吗？")) {
      await ui.withButtonLoading(
        "resetPositionsBtn",
        async () => {
          this.autoPositionMode = true;
          this.manualPositions = {};
          document.querySelectorAll(".position-select").forEach((select) => {
            select.value = "center";
          });
          document
            .querySelectorAll(".position-offset-input")
            .forEach((input) => {
              input.value = "0";
            });
          const autoCheckbox = document.getElementById("autoPositionCheckbox");
          if (autoCheckbox) {
            autoCheckbox.checked = true;
          }
          this.toggleManualConfig();
          await new Promise((resolve) => setTimeout(resolve, 300));
          this.savePositionConfig();
          ui.showStatus("已恢复默认位置配置！", "success");
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
      this.ensurePositionFormat();
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
