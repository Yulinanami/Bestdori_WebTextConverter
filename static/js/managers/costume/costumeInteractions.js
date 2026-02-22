import { modalService } from "@services/ModalService.js";
import { ui } from "@utils/uiUtils.js";
import { costumeRenderer } from "@managers/costume/costumeRenderer.js";

// 负责“怎么点”：绑定事件、响应按钮点击、弹窗输入、更新临时数据
export const costumeInteractions = {
  // 绑定服装列表里的各种点击/切换事件
  bindCostumeListEvents(costumeManager) {
    const costumeList = document.getElementById("costumeList");
    if (costumeList) {
      costumeList.addEventListener("click", (event) => {
        const clickedElement = event.target;
        const toggleButton = clickedElement.closest(
          ".toggle-costume-details-btn"
        );
        if (toggleButton) {
          const safeDomId = toggleButton.dataset.safeDomId;
          this.toggleCostumeDetails(safeDomId);
          return;
        }

        const addButton = clickedElement.closest(".add-costume-btn");
        if (addButton) {
          const { characterName, safeDomId } = addButton.dataset;
          this.addNewCostume(costumeManager, characterName, safeDomId);
          return;
        }

        const databaseButton = clickedElement.closest(".open-live2d-db-btn");
        if (databaseButton) {
          this.openLive2DDatabase();
          return;
        }

        const editButton = clickedElement.closest(".edit-costume-btn");
        if (editButton) {
          const {
            characterName,
            index,
            costume: oldCostumeId,
            safeDomId,
          } = editButton.dataset;
          const costumeIndex = parseInt(index, 10);
          this.editCostume(
            costumeManager,
            characterName,
            costumeIndex,
            oldCostumeId,
            safeDomId
          );
          return;
        }

        const deleteButton = clickedElement.closest(".delete-costume-btn");
        if (deleteButton) {
          const { characterName, index, safeDomId } = deleteButton.dataset;
          const costumeIndex = parseInt(index, 10);
          this.deleteCostume(
            costumeManager,
            characterName,
            costumeIndex,
            safeDomId
          );
          return;
        }
      });
      costumeList.addEventListener("change", (event) => {
        const select = event.target.closest(".costume-select");
        if (select) {
          const characterName = select.dataset.characterName;
          const selectedCostumeId = select.value;
          costumeManager.tempCostumeChanges[characterName] = selectedCostumeId;
        }
      });
    }

    const saveButton = document.getElementById("saveCostumesBtn");
    if (saveButton) {
      saveButton.addEventListener(
        "click",
        costumeManager.saveCostumes.bind(costumeManager)
      );
    }

    const resetButton = document.getElementById("resetCostumesBtn");
    if (resetButton) {
      resetButton.addEventListener(
        "click",
        costumeManager.resetCostumes.bind(costumeManager)
      );
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
  async addNewCostume(costumeManager, characterName, safeDomId) {
    const costumeId = await modalService.prompt("请输入新的服装ID：");
    if (costumeId && costumeId.trim()) {
      const trimmedCostumeId = costumeId.trim();

      if (!costumeManager.tempAvailableCostumes[characterName]) {
        costumeManager.tempAvailableCostumes[characterName] = [];
      }

      if (
        costumeManager.tempAvailableCostumes[characterName].includes(
          trimmedCostumeId
        )
      ) {
        ui.showStatus("该服装ID已存在", "error");
        return;
      }

      costumeManager.tempAvailableCostumes[characterName].push(trimmedCostumeId);
      costumeRenderer.updateCostumeListUI(
        costumeManager,
        characterName,
        safeDomId
      );
      ui.showStatus(`已在临时列表添加服装: ${trimmedCostumeId}`, "info");
    }
  },

  // 编辑：把某个服装 ID 改成新值（会检查重复）
  async editCostume(
    costumeManager,
    characterName,
    index,
    oldCostumeId,
    safeDomId
  ) {
    const editedCostumeId = await modalService.prompt(
      "编辑服装ID：",
      oldCostumeId
    );
    if (
      editedCostumeId &&
      editedCostumeId.trim() &&
      editedCostumeId !== oldCostumeId
    ) {
      const trimmedCostumeId = editedCostumeId.trim();

      if (
        costumeManager.tempAvailableCostumes[characterName].includes(
          trimmedCostumeId
        )
      ) {
        ui.showStatus("该服装ID已存在", "error");
        return;
      }

      costumeManager.tempAvailableCostumes[characterName][index] =
        trimmedCostumeId;
      if (costumeManager.tempCostumeChanges[characterName] === oldCostumeId) {
        costumeManager.tempCostumeChanges[characterName] = trimmedCostumeId;
      }

      costumeRenderer.updateCostumeListUI(
        costumeManager,
        characterName,
        safeDomId
      );
    }
  },

  // 删除：从临时列表移除某个服装 ID（会二次确认）
  async deleteCostume(costumeManager, characterName, index, safeDomId) {
    const costumeIdToDelete =
      costumeManager.tempAvailableCostumes[characterName][index];
    const confirmed = await modalService.confirm(
      `确定要删除服装 "${costumeIdToDelete}" 吗？`
    );

    if (confirmed) {
      costumeManager.tempAvailableCostumes[characterName].splice(index, 1);
      if (costumeManager.tempCostumeChanges[characterName] === costumeIdToDelete) {
        costumeManager.tempCostumeChanges[characterName] = "";
      }
      costumeRenderer.updateCostumeListUI(
        costumeManager,
        characterName,
        safeDomId
      );
    }
  },
};
