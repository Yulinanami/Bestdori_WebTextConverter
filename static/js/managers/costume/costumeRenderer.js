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
      ([, characterIds]) => characterIds?.[0] ?? Infinity,
      "asc",
    );

    characterEntries.forEach(([characterName, characterIds]) => {
      if (!characterIds || characterIds.length === 0) return;

      const clone = template.content.cloneNode(true);
      const costumeItem = clone.querySelector(".costume-config-item");
      const primaryCharacterId = characterIds[0];
      const safeDomId = manager.getSafeDomId(characterName);
      const avatarId = configManager.getAvatarId(primaryCharacterId);
      const availableCostumesForCharacter =
        manager.tempAvailableCostumes[characterName] || [];
      const selectedCostumeId = manager.tempCostumeChanges[characterName] || "";

      const avatarDiv = costumeItem.querySelector(".config-avatar");
      avatarDiv.dataset.id = primaryCharacterId;
      const avatarPath =
        avatarId > 0 ? `/static/images/avatars/${avatarId}.png` : "";

      if (avatarId > 0) {
        const img = DOMUtils.createElement("img", {
          src: avatarPath,
          alt: characterName,
          class: "config-avatar-img",
        });

        img.addEventListener("error", () => {
          img.style.display = "none";
          img.parentElement.textContent = characterName.charAt(0);
          img.parentElement.classList.add("fallback");
        });

        DOMUtils.clearElement(avatarDiv);
        avatarDiv.appendChild(img);
      } else {
        avatarDiv.textContent = characterName.charAt(0);
        avatarDiv.classList.add("fallback");
      }

      costumeItem.querySelector(".costume-character-name").textContent =
        `${characterName} (ID: ${primaryCharacterId})`;

      const toggleBtn = costumeItem.querySelector(
        ".toggle-costume-details-btn",
      );

      toggleBtn.dataset.safeDomId = safeDomId;
      toggleBtn.querySelector("span").id = `toggle-${safeDomId}`;
      const detailsDiv = costumeItem.querySelector(".costume-details");
      detailsDiv.id = `costume-details-${safeDomId}`;
      const select = costumeItem.querySelector(".costume-select");
      select.dataset.characterName = characterName;

      select.innerHTML =
        `<option value="">无服装</option>` +
        availableCostumesForCharacter
          .map(
            (costumeId) =>
              `<option value="${costumeId}" ${
                costumeId === selectedCostumeId ? "selected" : ""
              }>${costumeId}</option>`,
          )
          .join("");

      const addBtn = costumeItem.querySelector(".add-costume-btn");
      addBtn.dataset.characterName = characterName;
      addBtn.dataset.safeDomId = safeDomId;
      const listItems = costumeItem.querySelector(".costume-list-items");
      listItems.id = `costume-list-${safeDomId}`;

      listItems.innerHTML = this.renderCostumeListItems(
        characterName,
        availableCostumesForCharacter,
        safeDomId,
      );

      fragment.appendChild(costumeItem);
    });
    DOMUtils.clearElement(costumeList);
    costumeList.appendChild(fragment);
  },

  // 生成“某个角色的可用服装列表”HTML（用于 innerHTML）
  renderCostumeListItems(characterName, availableCostumeIds, safeDomId) {
    if (!availableCostumeIds || availableCostumeIds.length === 0) {
      return '<div class="empty-costume-list">暂无可用服装</div>';
    }

    return availableCostumeIds
      .map(
        (costumeId, index) => `
        <div class="costume-list-item">
            <span>${costumeId}</span>
            <div class="costume-item-actions">
                <button class="btn btn-icon-action edit-costume-btn" title="编辑服装ID" data-character-name="${characterName}" data-index="${index}" data-costume="${costumeId}" data-safe-dom-id="${safeDomId}">
                    <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="btn btn-icon-action btn-icon-danger delete-costume-btn" title="删除此服装" data-character-name="${characterName}" data-index="${index}" data-safe-dom-id="${safeDomId}">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            </div>
        </div>
    `,
      )
      .join("");
  },

  // 更新某个角色的局部 UI（服装列表区域 + 下拉框选项）
  updateCostumeListUI(manager, characterName, safeDomId) {
    const listContainer = document.getElementById(`costume-list-${safeDomId}`);
    if (listContainer) {
      const availableCostumesForCharacter =
        manager.tempAvailableCostumes[characterName] || [];
      listContainer.innerHTML = this.renderCostumeListItems(
        characterName,
        availableCostumesForCharacter,
        safeDomId,
      );
    }
    const costumeDetailsContainer = document.getElementById(
      `costume-details-${safeDomId}`,
    );
    if (costumeDetailsContainer) {
      const select = costumeDetailsContainer.querySelector(".costume-select");
      if (select && select.dataset.characterName === characterName) {
        const selectedCostumeId =
          manager.tempCostumeChanges[characterName] || "";
        const availableCostumesForCharacter =
          manager.tempAvailableCostumes[characterName] || [];

        DOMUtils.clearElement(select);

        const emptyOption = DOMUtils.createElement("option", { value: "" });
        emptyOption.textContent = "无服装";
        select.appendChild(emptyOption);

        availableCostumesForCharacter.forEach((costumeId) => {
          const option = DOMUtils.createElement("option", { value: costumeId });
          option.textContent = costumeId;

          if (costumeId === selectedCostumeId) {
            option.selected = true;
          }
          select.appendChild(option);
        });
      }
    }
  },
};
