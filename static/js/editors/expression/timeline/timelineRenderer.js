import { DOMUtils } from "@utils/DOMUtils.js";
import { renderGroupedView } from "@utils/uiUtils.js";
import {
  createTalkCard,
  createLayoutCard,
} from "@utils/TimelineCardFactory.js";
import { editorService } from "@services/EditorService.js";

/**
 * 时间轴渲染模块，负责普通与分组模式的卡片绘制。
 */
export function renderTimeline(editor) {
  const timeline = editor.domCache.timeline;
  if (!timeline) return;

  const isGroupingEnabled = editor.domCache.groupCheckbox?.checked || false;
  const actions = editor.projectFileState.actions;
  const groupSize = 50;

  const actionIndexMap = new Map(
    editor.projectFileState.actions.map((a, idx) => [a.id, idx])
  );

  const renderSingleCard = (action) => {
    const globalIndex = actionIndexMap.get(action.id) ?? -1;
    let card;

    if (action.type === "talk") {
      card = createTalkCard(action);
    } else if (action.type === "layout") {
      card = createLayoutCard(action, {
        renderLayoutControls: (cardEl, layoutAction, characterName) =>
          editor.renderLayoutCardControls(cardEl, layoutAction, characterName, {
            showToggleButton: false,
          }),
      });
    } else {
      return null;
    }
    const numberDiv = card.querySelector(".card-sequence-number");
    if (numberDiv && globalIndex !== -1) {
      numberDiv.textContent = `#${globalIndex + 1}`;
    }

    const footer = card.querySelector(".timeline-item-footer");
    if (editor._actionHasExpressionData(action)) {
      if (action.type === "talk") {
        const assignmentsContainer = DOMUtils.createElement("div", {
          className: "motion-assignments-container",
        });
        assignmentsContainer.dataset.actionId = action.id;

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
        characterSelector.style.display = "none";

        const setupButton = DOMUtils.createButton(
          "设置动作/表情",
          "btn btn-secondary btn-sm setup-expressions-btn"
        );

        DOMUtils.clearElement(footer);
        footer.appendChild(assignmentsContainer);
        footer.appendChild(characterSelector);
        footer.appendChild(setupButton);
      } else if (action.type === "layout") {
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
            motion: action.initialState?.motion || "",
            expression: action.initialState?.expression || "",
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

        DOMUtils.clearElement(footer);
        footer.appendChild(assignmentsContainer);
      }
    } else {
      DOMUtils.clearElement(footer);
      const setupButton = DOMUtils.createButton(
        "设置动作/表情",
        "btn btn-secondary btn-sm setup-expressions-btn"
      );
      footer.appendChild(setupButton);
    }

    return card;
  };

  if (isGroupingEnabled && actions.length > groupSize) {
    renderGroupedView({
      container: timeline,
      actions: actions,
      activeGroupIndex: editor.activeGroupIndex,
      onGroupClick: (index) => {
        const isOpening = editor.activeGroupIndex !== index;
        editor.activeGroupIndex = isOpening ? index : null;
        editor.renderTimeline();

        if (isOpening) {
          setTimeout(() => {
            const scrollContainer = editor.domCache.timeline;
            const header = scrollContainer?.querySelector(
              `.timeline-group-header[data-group-idx="${index}"]`
            );
            if (scrollContainer && header) {
              scrollContainer.scrollTo({
                top: header.offsetTop - 110,
                behavior: "smooth",
              });
            }
          }, 0);
        }
      },
      renderItemFn: renderSingleCard,
      groupSize: groupSize,
    });
  } else {
    DOMUtils.clearElement(timeline);
    const fragment = document.createDocumentFragment();
    actions.forEach((action) => {
      const card = renderSingleCard(action);
      if (card) fragment.appendChild(card);
    });
    timeline.appendChild(fragment);
  }
}
