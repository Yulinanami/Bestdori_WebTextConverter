import { DOMUtils } from "@utils/DOMUtils.js";
import { editorService } from "@services/EditorService.js";

/**
 * 负责动作/表情分配区域的 DOM 渲染。
 */
export const assignmentRenderer = {
  showExpressionSetupUI(editor, cardElement) {
    const actionId = cardElement.dataset.id;
    const action = editor.projectFileState.actions.find((a) => a.id === actionId);
    if (!action) return;

    const footer = cardElement.querySelector(".timeline-item-footer");
    if (!footer) return;

    DOMUtils.clearElement(footer);

    if (action.type === "layout") {
      if (!action.initialState) {
        action.initialState = {};
      }

      const assignmentsContainer = DOMUtils.createElement("div", {
        className: "motion-assignments-container",
      });
      assignmentsContainer.dataset.actionId = action.id;

      const char = {
        id: action.characterId,
        name:
          action.characterName ||
          editorService.getCharacterNameById(action.characterId),
      };

      if (char.name) {
        const motionData = {
          character: char.id,
          motion: action.initialState.motion || "",
          expression: action.initialState.expression || "",
          delay: action.delay || 0,
        };

        const assignmentItem = editor._createAssignmentItem(
          action,
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

    if (action.motions && action.motions.length > 0) {
      action.motions.forEach((motionData, index) => {
        const assignmentItem = editor._createAssignmentItem(
          action,
          motionData,
          index
        );
        assignmentsContainer.appendChild(assignmentItem);
      });
    }

    const characterSelector = editor._createCharacterSelector(action);

    const setupButton = DOMUtils.createButton(
      "设置动作/表情",
      "btn btn-secondary btn-sm setup-expressions-btn"
    );

    footer.appendChild(assignmentsContainer);
    footer.appendChild(characterSelector);
    footer.appendChild(setupButton);
    characterSelector.style.display = "none";
  },

  createCharacterSelector(editor, action) {
    const template = document.getElementById("motion-character-selector-template");
    const selectorFragment = template.content.cloneNode(true);

    const selectorContainer = DOMUtils.createElement("div");
    selectorContainer.appendChild(selectorFragment);
    const selector = selectorContainer.firstElementChild;

    const listContainer = selector.querySelector(".character-selector-list");

    let availableCharacters = [];
    if (action.type === "talk") {
      availableCharacters = editor._getStagedCharacters();
    } else if (action.type === "layout") {
      const char = {
        id: action.characterId,
        name:
          action.characterName ||
          editorService.getCharacterNameById(action.characterId),
      };
      if (char.name) {
        availableCharacters = [char];
      }
    }

    availableCharacters.forEach((char) => {
      const optionTemplate = document.getElementById(
        "motion-character-option-template"
      );
      const option = optionTemplate.content.cloneNode(true);
      const optionElement = option.querySelector(".character-selector-item");

      optionElement.dataset.characterId = char.id;
      optionElement.dataset.characterName = char.name;

      const avatarDiv = option.querySelector(".dialogue-avatar");
      editorService.updateCharacterAvatar(
        { querySelector: () => avatarDiv },
        char.id,
        char.name
      );

      option.querySelector(".character-name").textContent = char.name;
      listContainer.appendChild(option);
    });

    return selector;
  },

  createAssignmentItem(editor, action, motionData, index, isLayoutCard = false) {
    const template = document.getElementById("motion-assignment-item-template");
    const itemFragment = template.content.cloneNode(true);

    const itemContainer = DOMUtils.createElement("div");
    itemContainer.appendChild(itemFragment);
    const itemElement = itemContainer.firstElementChild;

    const characterName = editorService.getCharacterNameById(motionData.character);

    itemElement.dataset.characterId = motionData.character;
    itemElement.dataset.characterName = characterName;
    itemElement.dataset.assignmentIndex = index;
    itemElement.dataset.actionId = action.id;

    if (isLayoutCard) {
      const removeBtn = itemElement.querySelector(".assignment-remove-btn");
      if (removeBtn) {
        DOMUtils.toggleDisplay(removeBtn, false);
      }
    }

    const avatarDiv = itemElement.querySelector(".dialogue-avatar");
    editorService.updateCharacterAvatar(
      { querySelector: () => avatarDiv },
      motionData.character,
      characterName
    );
    itemElement.querySelector(".character-name").textContent = characterName;

    const motionValue = itemElement.querySelector(
      ".motion-drop-zone .drop-zone-value"
    );
    const motionClearBtn = itemElement.querySelector(
      ".motion-drop-zone .clear-state-btn"
    );
    motionValue.textContent = motionData.motion || "--";
    if (motionClearBtn) {
      DOMUtils.toggleDisplay(motionClearBtn, !!motionData.motion);
    }

    const expressionValue = itemElement.querySelector(
      ".expression-drop-zone .drop-zone-value"
    );
    const expressionClearBtn = itemElement.querySelector(
      ".expression-drop-zone .clear-state-btn"
    );
    expressionValue.textContent = motionData.expression || "--";
    if (expressionClearBtn) {
      DOMUtils.toggleDisplay(expressionClearBtn, !!motionData.expression);
    }

    const delayInput = itemElement.querySelector(".assignment-delay-input");
    delayInput.value = motionData.delay || 0;

    editor._initSortableForAssignmentZones(itemElement, isLayoutCard);

    return itemElement;
  },
};
