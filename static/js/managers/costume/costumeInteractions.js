import { modalService } from "@services/ModalService.js";
import { ui } from "@utils/uiUtils.js";
import { costumeRenderer } from "@managers/costume/costumeRenderer.js";

// 负责“怎么点”：绑定事件、响应按钮点击、弹窗输入、更新临时数据
export const costumeInteractions = {
  // 绑定服装列表里的各种点击/切换事件
  bindCostumeListEvents(manager) {
    const costumeList = document.getElementById("costumeList");
    if (costumeList) {
      costumeList.addEventListener("click", (e) => {
        const target = e.target;
        const toggleBtn = target.closest(".toggle-costume-details-btn");
        if (toggleBtn) {
          const safeDomId = toggleBtn.dataset.safeDomId;
          this.toggleCostumeDetails(safeDomId);
          return;
        }

        const addBtn = target.closest(".add-costume-btn");
        if (addBtn) {
          const { characterKey, safeDomId } = addBtn.dataset;
          this.addNewCostume(manager, characterKey, safeDomId);
          return;
        }

        const dbBtn = target.closest(".open-live2d-db-btn");
        if (dbBtn) {
          this.openLive2DDatabase();
          return;
        }

        const editBtn = target.closest(".edit-costume-btn");
        if (editBtn) {
          const { characterKey, index, costume, safeDomId } = editBtn.dataset;
          this.editCostume(
            manager,
            characterKey,
            parseInt(index),
            costume,
            safeDomId
          );
          return;
        }

        const deleteBtn = target.closest(".delete-costume-btn");
        if (deleteBtn) {
          const { characterKey, index, safeDomId } = deleteBtn.dataset;
          this.deleteCostume(
            manager,
            characterKey,
            parseInt(index),
            safeDomId
          );
          return;
        }
      });
      costumeList.addEventListener("change", (e) => {
        const select = e.target.closest(".costume-select");
        if (select) {
          const key = select.dataset.characterKey;
          manager.tempCostumeChanges[key] = select.value;
        }
      });
    }

    const saveBtn = document.getElementById("saveCostumesBtn");
    if (saveBtn) {
      saveBtn.addEventListener("click", manager.saveCostumes.bind(manager));
    }

    const resetBtn = document.getElementById("resetCostumesBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", manager.resetCostumes.bind(manager));
    }
  },

  // 打开 Bestdori Live2D 数据库（新标签页）
  openLive2DDatabase() {
    window.open(
      "https://bestdori.com/tool/explorer/asset/jp/live2d/chara",
      "_blank"
    );
  },

  // 展开/收起某个角色的详情面板
  toggleCostumeDetails(safeDomId) {
    const details = document.getElementById(`costume-details-${safeDomId}`);
    const toggle = document.getElementById(`toggle-${safeDomId}`);
    const isHidden =
      details.classList.contains("hidden") ||
      details.style.display === "none" ||
      window.getComputedStyle(details).display === "none";

    if (isHidden) {
      details.classList.remove("hidden");
      details.style.display = "block";
      toggle.textContent = "▲";
    } else {
      details.classList.add("hidden");
      details.style.display = "none";
      toggle.textContent = "▼";
    }
  },

  // 新增：弹窗输入一个服装 ID，并加入临时列表
  async addNewCostume(manager, characterKey, safeDomId) {
    const costumeId = await modalService.prompt("请输入新的服装ID：");
    if (costumeId && costumeId.trim()) {
      const trimmedId = costumeId.trim();

      if (!manager.tempAvailableCostumes[characterKey]) {
        manager.tempAvailableCostumes[characterKey] = [];
      }

      if (manager.tempAvailableCostumes[characterKey].includes(trimmedId)) {
        ui.showStatus("该服装ID已存在", "error");
        return;
      }

      manager.tempAvailableCostumes[characterKey].push(trimmedId);
      costumeRenderer.updateCostumeListUI(manager, characterKey, safeDomId);
      ui.showStatus(`已在临时列表添加服装: ${trimmedId}`, "info");
    }
  },

  // 编辑：把某个服装 ID 改成新值（会检查重复）
  async editCostume(manager, characterKey, index, oldCostume, safeDomId) {
    const newCostume = await modalService.prompt("编辑服装ID：", oldCostume);
    if (newCostume && newCostume.trim() && newCostume !== oldCostume) {
      const trimmedId = newCostume.trim();

      if (manager.tempAvailableCostumes[characterKey].includes(trimmedId)) {
        ui.showStatus("该服装ID已存在", "error");
        return;
      }

      manager.tempAvailableCostumes[characterKey][index] = trimmedId;
      if (manager.tempCostumeChanges[characterKey] === oldCostume) {
        manager.tempCostumeChanges[characterKey] = trimmedId;
      }

      costumeRenderer.updateCostumeListUI(manager, characterKey, safeDomId);
    }
  },

  // 删除：从临时列表移除某个服装 ID（会二次确认）
  async deleteCostume(manager, characterKey, index, safeDomId) {
    const costume = manager.tempAvailableCostumes[characterKey][index];
    const confirmed = await modalService.confirm(
      `确定要删除服装 "${costume}" 吗？`
    );

    if (confirmed) {
      manager.tempAvailableCostumes[characterKey].splice(index, 1);
      if (manager.tempCostumeChanges[characterKey] === costume) {
        manager.tempCostumeChanges[characterKey] = "";
      }
      costumeRenderer.updateCostumeListUI(manager, characterKey, safeDomId);
    }
  },
};
