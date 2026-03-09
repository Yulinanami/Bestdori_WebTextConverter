// 渲染动作表情分配区
import { DOMUtils } from "@utils/DOMUtils.js";
import { configManager } from "@managers/configManager.js";
import { renderAvatar } from "@utils/avatarUtils.js";

// 分配区显示
export const assignUI = {
  // 刷新卡片底部
  renderCardFooter(editor, cardElement, options = {}) {
    const { action = null } = options;
    const actionId = cardElement?.dataset?.id;
    if (!actionId) return false;

    const resolvedAction =
      action ||
      editor.projectFileState.actions.find(
        (actionItem) => actionItem.id === actionId
      );
    if (!resolvedAction) return false;

    const footer = cardElement.querySelector(".timeline-item-footer");
    if (!footer) return false;

    DOMUtils.clearElement(footer);

    if (editor.hasExpressionData(resolvedAction)) {
      assignUI.showSetupUI(editor, cardElement, resolvedAction);
      return true;
    }

    const setupButton = DOMUtils.createButton(
      "设置动作/表情",
      "btn btn-secondary btn-sm setup-expressions-btn"
    );
    footer.appendChild(setupButton);
    return true;
  },

  // 渲染分配区
  showSetupUI(editor, cardElement, action = null) {
    const actionId = cardElement.dataset.id;
    const resolvedAction =
      action ||
      editor.projectFileState.actions.find(
        (actionItem) => actionItem.id === actionId
      );
    if (!resolvedAction) return;

    const footer = cardElement.querySelector(".timeline-item-footer");
    if (!footer) return;

    DOMUtils.clearElement(footer);

    if (resolvedAction.type === "layout") {
      const assignmentsContainer = DOMUtils.createElement("div", {
        className: "motion-assignments-container",
      });
      assignmentsContainer.dataset.actionId = resolvedAction.id;

      const characterInfo = {
        id: resolvedAction.characterId,
        name:
          resolvedAction.characterName ||
          configManager.findCharName(resolvedAction.characterId),
      };

      if (characterInfo.name) {
        const initialState = resolvedAction.initialState || {};
        const motionData = {
          character: characterInfo.id,
          motion: initialState.motion || "",
          expression: initialState.expression || "",
          delay: resolvedAction.delay || 0,
        };

        const assignmentItem = assignUI.createAssignmentItem(
          editor,
          resolvedAction,
          motionData,
          0,
          true
        );
        assignmentsContainer.appendChild(assignmentItem);
      }

      footer.appendChild(assignmentsContainer);
      return;
    }

    const assignmentsContainer = DOMUtils.createElement("div", {
      className: "motion-assignments-container",
    });
    assignmentsContainer.dataset.actionId = actionId;

    if (resolvedAction.motions && resolvedAction.motions.length > 0) {
      resolvedAction.motions.forEach((motionData, index) => {
        const assignmentItem = assignUI.createAssignmentItem(
          editor,
          resolvedAction,
          motionData,
          index
        );
        assignmentsContainer.appendChild(assignmentItem);
      });
    }

    const characterSelector = assignUI.buildCharPicker(
      editor,
      resolvedAction
    );

    const setupButton = DOMUtils.createButton(
      "设置动作/表情",
      "btn btn-secondary btn-sm setup-expressions-btn"
    );

    footer.appendChild(assignmentsContainer);
    footer.appendChild(characterSelector);
    footer.appendChild(setupButton);
    characterSelector.style.display = "none";
  },

  // 创建角色选择列表
  buildCharPicker(editor, action) {
    const template = document.getElementById(
      "motion-character-selector-template"
    );
    const selectorFragment = template.content.cloneNode(true);

    const selectorContainer = DOMUtils.createElement("div");
    selectorContainer.appendChild(selectorFragment);
    const selector = selectorContainer.firstElementChild;

    const listContainer = selector.querySelector(".character-selector-list");

    let availableCharacters = [];
    if (action.type === "talk") {
      availableCharacters = editor.listStagedChars();
    } else if (action.type === "layout") {
      const characterInfo = {
        id: action.characterId,
        name:
          action.characterName || configManager.findCharName(action.characterId),
      };
      if (characterInfo.name) {
        availableCharacters = [characterInfo];
      }
    }

    availableCharacters.forEach((characterInfo) => {
      const optionTemplate = document.getElementById(
        "motion-character-option-template"
      );
      const option = optionTemplate.content.cloneNode(true);
      const optionElement = option.querySelector(".character-selector-item");

      optionElement.dataset.characterId = characterInfo.id;
      optionElement.dataset.characterName = characterInfo.name;

      const avatarDiv = option.querySelector(".dialogue-avatar");
      renderAvatar(avatarDiv, characterInfo.id, characterInfo.name);

      option.querySelector(".character-name").textContent = characterInfo.name;
      listContainer.appendChild(option);
    });

    return selector;
  },

  // 创建一条分配项
  createAssignmentItem(
    editor,
    action,
    motionData,
    index,
    isLayoutCard = false
  ) {
    const template = document.getElementById("motion-assignment-item-template");
    const itemFragment = template.content.cloneNode(true);

    const itemContainer = DOMUtils.createElement("div");
    itemContainer.appendChild(itemFragment);
    const itemElement = itemContainer.firstElementChild;

    const characterName = configManager.findCharName(motionData.character);

    itemElement.dataset.characterId = motionData.character;
    itemElement.dataset.characterName = characterName;
    itemElement.dataset.assignmentIndex = index;
    itemElement.dataset.actionId = action.id;

    const avatarDiv = itemElement.querySelector(".dialogue-avatar");
    renderAvatar(avatarDiv, motionData.character, characterName);
    itemElement.querySelector(".character-name").textContent = characterName;

    const motionValue = itemElement.querySelector(
      ".motion-drop-zone .drop-zone-value"
    );
    const motionClearButton = itemElement.querySelector(
      ".motion-drop-zone .clear-state-btn"
    );
    motionValue.textContent = motionData.motion || "--";
    if (motionClearButton) {
      DOMUtils.toggleDisplay(motionClearButton, !!motionData.motion);
    }

    const expressionValue = itemElement.querySelector(
      ".expression-drop-zone .drop-zone-value"
    );
    const expressionClearButton = itemElement.querySelector(
      ".expression-drop-zone .clear-state-btn"
    );
    expressionValue.textContent = motionData.expression || "--";
    if (expressionClearButton) {
      DOMUtils.toggleDisplay(expressionClearButton, !!motionData.expression);
    }

    const delayInput = itemElement.querySelector(".assignment-delay-input");
    delayInput.value = motionData.delay || 0;

    editor.initAssignSortables(itemElement, isLayoutCard);

    return itemElement;
  },
};
