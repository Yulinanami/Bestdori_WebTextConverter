import { DataUtils } from "@utils/DataUtils.js";
import { DOMUtils } from "@utils/DOMUtils.js";
import { configManager } from "@managers/configManager.js";
import { state } from "@managers/stateManager.js";

// 把服装数据渲染成页面 DOM，并在数据变更时更新 UI
export const costumeRenderer = {
  // 渲染整个服装配置列表（每个角色一块）
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

  // 生成“某个角色的可用服装列表”HTML（用于 innerHTML）
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

  // 更新某个角色的局部 UI（服装列表区域 + 下拉框选项）
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
