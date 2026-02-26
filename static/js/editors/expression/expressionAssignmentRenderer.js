import { DOMUtils } from "@utils/DOMUtils.js";
import { editorService } from "@services/EditorService.js";
import { configUI } from "@managers/config/configUI.js";
import { assignmentStore } from "@editors/expression/expressionAssignmentStore.js";
import { assignmentDnd } from "@editors/expression/expressionAssignmentDnd.js";

// 分配 UI 渲染：负责把动作/表情分配区画到卡片底部
export const assignmentRenderer = {
  // 渲染卡片 footer：有分配数据就画分配区，否则只画“设置动作/表情”按钮。
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

    if (assignmentStore.actionHasExpressionData(resolvedAction)) {
      assignmentRenderer.showExpressionSetupUI(editor, cardElement, resolvedAction);
      return true;
    }

    const setupButton = DOMUtils.createButton(
      "设置动作/表情",
      "btn btn-secondary btn-sm setup-expressions-btn"
    );
    footer.appendChild(setupButton);
    return true;
  },

  // 根据 action 类型渲染分配区（talk 显示列表；layout 显示 initialState）
  showExpressionSetupUI(editor, cardElement, action = null) {
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
          editorService.configManager.getCharacterNameById(resolvedAction.characterId),
      };

      if (characterInfo.name) {
        const initialState = resolvedAction.initialState || {};
        const motionData = {
          character: characterInfo.id,
          motion: initialState.motion || "",
          expression: initialState.expression || "",
          delay: resolvedAction.delay || 0,
        };

        const assignmentItem = assignmentRenderer.createAssignmentItem(
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
        const assignmentItem = assignmentRenderer.createAssignmentItem(
          editor,
          resolvedAction,
          motionData,
          index
        );
        assignmentsContainer.appendChild(assignmentItem);
      });
    }

    const characterSelector = assignmentRenderer.createCharacterSelector(
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

  // 创建“选择角色”的列表（点了就添加一条分配）
  createCharacterSelector(editor, action) {
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
      availableCharacters = assignmentStore.getStagedCharacters(editor);
    } else if (action.type === "layout") {
      const characterInfo = {
        id: action.characterId,
        name:
          action.characterName ||
          editorService.configManager.getCharacterNameById(action.characterId),
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
      configUI.updateConfigAvatar(
        editorService.configManager,
        { querySelector: () => avatarDiv },
        characterInfo.id,
        characterInfo.name
      );

      option.querySelector(".character-name").textContent = characterInfo.name;
      listContainer.appendChild(option);
    });

    return selector;
  },

  // 创建一条分配项 DOM（头像 + 动作区 + 表情区 + 延迟输入 + 删除）
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

    const characterName = editorService.configManager.getCharacterNameById(
      motionData.character
    );

    itemElement.dataset.characterId = motionData.character;
    itemElement.dataset.characterName = characterName;
    itemElement.dataset.assignmentIndex = index;
    itemElement.dataset.actionId = action.id;

    const avatarDiv = itemElement.querySelector(".dialogue-avatar");
    configUI.updateConfigAvatar(
      editorService.configManager,
      { querySelector: () => avatarDiv },
      motionData.character,
      characterName
    );
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

    assignmentDnd.initSortableForAssignmentZones(
      editor,
      itemElement,
      isLayoutCard
    );

    return itemElement;
  },
};
