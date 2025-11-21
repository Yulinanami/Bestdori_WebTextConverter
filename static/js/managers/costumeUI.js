import { DataUtils } from "../utils/DataUtils.js";
import { DOMUtils } from "../utils/DOMUtils.js";
import { configManager } from "./configManager.js";
import { modalService } from "../services/ModalService.js";
import { ui } from "../utils/uiUtils.js";
import { state } from "./stateManager.js";

/**
 * 负责服装管理的 DOM 渲染与事件绑定逻辑。
 * 将 UI 相关代码与数据存取逻辑解耦，便于单独维护。
 */
export const costumeUI = {
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

  /**
   * 渲染服装配置列表
   * 为每个角色创建配置卡片,包含:
   * - 角色头像和名称
   * - 当前服装下拉选择器
   * - 可折叠的详细配置区域(服装ID列表、添加/编辑/删除按钮)
   * 使用临时状态(tempCostumeChanges/tempAvailableCostumes)进行编辑
   */
  renderCostumeList(manager) {
    const costumeList = document.getElementById("costumeList");
    const template = document.getElementById("costume-item-template");
    const fragment = document.createDocumentFragment();
    const characterEntries = DataUtils.sortBy(
      Object.entries(state.get("currentConfig")),
      ([, ids]) => ids?.[0] ?? Infinity,
      "asc"
    );

    characterEntries.forEach(([name, ids]) => {
      if (!ids || ids.length === 0) return;

      const clone = template.content.cloneNode(true);
      const costumeItem = clone.querySelector(".costume-config-item");
      const primaryId = ids[0];
      const characterKey = manager.getCharacterKey(name);
      const safeDomId = manager.getSafeDomId(name);
      const avatarId = configManager.getAvatarId(primaryId);
      const availableForCharacter =
        manager.tempAvailableCostumes[characterKey] || [];
      const currentCostume = manager.tempCostumeChanges[characterKey] || "";

      const avatarDiv = costumeItem.querySelector(".config-avatar");
      avatarDiv.dataset.id = primaryId;
      const avatarPath =
        avatarId > 0 ? `/static/images/avatars/${avatarId}.png` : "";

      if (avatarId > 0) {
        const img = DOMUtils.createElement("img", {
          src: avatarPath,
          alt: name,
          class: "config-avatar-img",
        });

        img.addEventListener("error", function () {
          this.style.display = "none";
          this.parentElement.textContent = name.charAt(0);
          this.parentElement.classList.add("fallback");
        });

        DOMUtils.clearElement(avatarDiv);
        avatarDiv.appendChild(img);
      } else {
        avatarDiv.textContent = name.charAt(0);
        avatarDiv.classList.add("fallback");
      }

      costumeItem.querySelector(
        ".costume-character-name"
      ).textContent = `${name} (ID: ${primaryId})`;

      const toggleBtn = costumeItem.querySelector(
        ".toggle-costume-details-btn"
      );

      toggleBtn.dataset.safeDomId = safeDomId;
      toggleBtn.querySelector("span").id = `toggle-${safeDomId}`;
      const detailsDiv = costumeItem.querySelector(".costume-details");
      detailsDiv.id = `costume-details-${safeDomId}`;
      const select = costumeItem.querySelector(".costume-select");
      select.dataset.characterKey = characterKey;

      select.innerHTML =
        `<option value="">无服装</option>` +
        availableForCharacter
          .map(
            (costume) =>
              `<option value="${costume}" ${
                costume === currentCostume ? "selected" : ""
              }>${costume}</option>`
          )
          .join("");

      const addBtn = costumeItem.querySelector(".add-costume-btn");
      addBtn.dataset.characterKey = characterKey;
      addBtn.dataset.safeDomId = safeDomId;
      const listItems = costumeItem.querySelector(".costume-list-items");
      listItems.id = `costume-list-${safeDomId}`;

      listItems.innerHTML = this.renderCostumeListItems(
        characterKey,
        availableForCharacter,
        safeDomId
      );

      fragment.appendChild(costumeItem);
    });
    DOMUtils.clearElement(costumeList);
    costumeList.appendChild(fragment);
  },

  // 添加打开 Live2D 数据库的方法
  openLive2DDatabase() {
    window.open(
      "https://bestdori.com/tool/explorer/asset/jp/live2d/chara",
      "_blank"
    );
  },

  // 渲染服装列表项
  renderCostumeListItems(characterKey, costumes, safeDomId) {
    if (!costumes || costumes.length === 0) {
      return '<div class="empty-costume-list">暂无可用服装</div>';
    }

    return costumes
      .map(
        (costume, index) => `
        <div class="costume-list-item">
            <span>${costume}</span>
            <div class="costume-item-actions">
                <button class="btn btn-icon-action edit-costume-btn" title="编辑服装ID" data-character-key="${characterKey}" data-index="${index}" data-costume="${costume}" data-safe-dom-id="${safeDomId}">
                    <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="btn btn-icon-action btn-icon-danger delete-costume-btn" title="删除此服装" data-character-key="${characterKey}" data-index="${index}" data-safe-dom-id="${safeDomId}">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        </div>
    `
      )
      .join("");
  },

  // 切换服装详情显示
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

  // 添加新服装（只修改临时状态）
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
      this.updateCostumeListUI(manager, characterKey, safeDomId);
      ui.showStatus(`已在临时列表添加服装: ${trimmedId}`, "info");
    }
  },

  // 编辑服装（只修改临时状态）
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

      this.updateCostumeListUI(manager, characterKey, safeDomId);
    }
  },

  // 删除服装（只修改临时状态）
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
      this.updateCostumeListUI(manager, characterKey, safeDomId);
    }
  },

  // 更新服装列表UI（基于临时状态）
  updateCostumeListUI(manager, characterKey, safeDomId) {
    const listContainer = document.getElementById(`costume-list-${safeDomId}`);
    if (listContainer) {
      const costumes = manager.tempAvailableCostumes[characterKey] || [];
      listContainer.innerHTML = this.renderCostumeListItems(
        characterKey,
        costumes,
        safeDomId
      );
    }
    const costumeDetailsContainer = document.getElementById(
      `costume-details-${safeDomId}`
    );
    if (costumeDetailsContainer) {
      const select = costumeDetailsContainer.querySelector(".costume-select");
      if (select && select.dataset.characterKey === characterKey) {
        const currentValue = manager.tempCostumeChanges[characterKey] || "";
        const availableForCharacter =
          manager.tempAvailableCostumes[characterKey] || [];

        DOMUtils.clearElement(select);

        const emptyOption = DOMUtils.createElement("option", { value: "" });
        emptyOption.textContent = "无服装";
        select.appendChild(emptyOption);

        availableForCharacter.forEach((costume) => {
          const option = DOMUtils.createElement("option", { value: costume });
          option.textContent = costume;

          if (costume === currentValue) {
            option.selected = true;
          }
          select.appendChild(option);
        });
      }
    }
  },
};
