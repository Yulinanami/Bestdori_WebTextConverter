import { DOMUtils } from "@utils/DOMUtils.js";
import { configManager } from "@managers/configManager.js";
import { state } from "@managers/stateManager.js";

/**
 * 负责位置配置的列表渲染与 DOM 结构。
 */
export const positionUI = {
  createPositionItem(name, primaryId, avatarId, avatarPath, currentPosition, currentOffset) {
    const item = DOMUtils.createElement("div", {
      class: "position-config-item",
    });

    const infoDiv = this.createCharacterInfo(name, primaryId, avatarId, avatarPath);
    const controlsDiv = this.createPositionControls(
      name,
      currentPosition,
      currentOffset
    );

    DOMUtils.appendChildren(item, [infoDiv, controlsDiv]);

    return item;
  },

  createCharacterInfo(name, primaryId, avatarId, avatarPath) {
    const infoDiv = DOMUtils.createElement("div", {
      class: "position-character-info",
    });

    const avatarWrapper = DOMUtils.createElement("div", {
      class: "config-avatar-wrapper",
    });

    const avatarDiv = DOMUtils.createElement("div", {
      class: "config-avatar",
      "data-id": primaryId,
    });

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

      avatarDiv.appendChild(img);
    } else {
      avatarDiv.textContent = name.charAt(0);
      avatarDiv.classList.add("fallback");
    }

    avatarWrapper.appendChild(avatarDiv);
    infoDiv.appendChild(avatarWrapper);

    const nameSpan = DOMUtils.createElement("span", {
      class: "position-character-name",
    });
    nameSpan.textContent = `${name} (ID: ${primaryId})`;
    infoDiv.appendChild(nameSpan);

    return infoDiv;
  },

  createPositionControls(name, currentPosition, currentOffset) {
    const controlsDiv = DOMUtils.createElement("div", {
      class: "position-controls",
    });

    const select = DOMUtils.createElement("select", {
      class: "form-input position-select",
      "data-character": name,
    });

    ["leftOver", "leftInside", "center", "rightInside", "rightOver"].forEach((pos) => {
      const option = DOMUtils.createElement("option", { value: pos });
      option.textContent = this.positionNames[pos];
      if (pos === currentPosition) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    controlsDiv.appendChild(select);

    const offsetGroup = this.createOffsetInputGroup(name, currentOffset);
    controlsDiv.appendChild(offsetGroup);

    return controlsDiv;
  },

  createOffsetInputGroup(name, currentOffset) {
    const offsetGroup = DOMUtils.createElement("div", {
      class: "position-offset-group",
    });

    const label = DOMUtils.createElement("label", {
      class: "position-offset-label",
      for: `offset-${name}`,
    });
    label.textContent = "偏移:";

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

    const hint = DOMUtils.createElement("span", {
      class: "position-offset-hint",
    });
    hint.textContent = "px";

    DOMUtils.appendChildren(offsetGroup, [label, input, hint]);

    return offsetGroup;
  },

  renderPositionList(manager) {
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
      const currentConfig = manager.tempManualPositions[name] || {
        position: "center",
        offset: 0,
      };
      const currentPosition = currentConfig.position || "center";
      const currentOffset = currentConfig.offset || 0;

      const item = this.createPositionItem(
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
};

// 提供位置名称映射用于 select 渲染
positionUI.positionNames = {
  leftOver: "左外",
  leftInside: "左内",
  center: "中间",
  rightInside: "右内",
  rightOver: "右外",
};
