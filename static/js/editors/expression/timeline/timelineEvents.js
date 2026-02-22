import { DOMUtils } from "@utils/DOMUtils.js";

// 时间线事件：处理点击“设置/删除/清空动作表情”等按钮，以及延迟输入变化
export function bindTimelineEvents(editor) {
  const timeline = editor.domCache.timeline;
  if (!timeline) return;

  timeline.onclick = (clickEvent) => {
    const timelineCard = clickEvent.target.closest(".timeline-item");
    if (!timelineCard) return;

    if (clickEvent.target.matches(".setup-expressions-btn")) {
      const actionId = timelineCard.dataset.id;
      const action = editor.projectFileState.actions.find(
        (actionItem) => actionItem.id === actionId
      );

      const footer = timelineCard.querySelector(".timeline-item-footer");

      if (action && action.type === "layout") {
        const created = editor._ensureLayoutAssignment(actionId);
        const freshCard =
          (created &&
            editor.domCache.timeline?.querySelector(
              `.layout-item[data-id="${actionId}"]`
            )) ||
          timelineCard;
        editor.showExpressionSetupUI(freshCard);
        return;
      }

      const characterSelector = footer?.querySelector(
        ".motion-character-selector"
      );
      if (characterSelector) {
        const isHidden = characterSelector.style.display === "none";
        characterSelector.style.display = isHidden ? "block" : "none";
      } else {
        editor.showExpressionSetupUI(timelineCard);
        const newSelector = footer?.querySelector(".motion-character-selector");
        if (newSelector) {
          newSelector.style.display = "block";
        }
      }
      return;
    }

    if (
      clickEvent.target.matches(".character-selector-item") ||
      clickEvent.target.closest(".character-selector-item")
    ) {
      const characterItem = clickEvent.target.closest(".character-selector-item");
      if (characterItem) {
        const characterId = parseInt(characterItem.dataset.characterId);
        const characterName = characterItem.dataset.characterName;
        const actionId = timelineCard.dataset.id;
        const action = editor.projectFileState.actions.find(
          (actionItem) => actionItem.id === actionId
        );
        if (action) {
          editor._addMotionAssignment(action, {
            id: characterId,
            name: characterName,
          });
          const footer = timelineCard.querySelector(".timeline-item-footer");
          const characterSelector = footer?.querySelector(
            ".motion-character-selector"
          );
          if (characterSelector) {
            characterSelector.style.display = "none";
          }
        }
      }
      return;
    }

    if (clickEvent.target.matches(".assignment-remove-btn")) {
      const assignmentItem = clickEvent.target.closest(".motion-assignment-item");
      if (assignmentItem) {
        const assignmentIndex = parseInt(
          assignmentItem.dataset.assignmentIndex
        );
        const actionId = timelineCard.dataset.id;
        const action = editor.projectFileState.actions.find(
          (actionItem) => actionItem.id === actionId
        );
        if (action && action.type === "layout") {
          editor._executeCommand((currentState) => {
            const layoutAction = currentState.actions.find(
              (actionItem) => actionItem.id === actionId
            );
            if (layoutAction) {
              delete layoutAction.initialState;
              delete layoutAction.delay;
            }
          });
        } else {
          editor._removeMotionAssignment(actionId, assignmentIndex);
        }
      }
      return;
    }

    if (clickEvent.target.matches(".clear-state-btn")) {
      const dropZone = clickEvent.target.closest(".drop-zone");
      const assignmentItem = clickEvent.target.closest(".motion-assignment-item");
      if (assignmentItem && dropZone) {
        const actionId = assignmentItem.dataset.actionId;
        const assignmentIndex = parseInt(
          assignmentItem.dataset.assignmentIndex
        );
        const type = dropZone.dataset.type;

        const valueElement = dropZone.querySelector(".drop-zone-value");
        if (valueElement) {
          valueElement.textContent = "--";
        }
        DOMUtils.toggleDisplay(clickEvent.target, false);

        const action = editor.projectFileState.actions.find(
          (actionItem) => actionItem.id === actionId
        );
        const updates = {};
        updates[type] = "";

        if (action && action.type === "layout") {
          editor._updateLayoutInitialState(actionId, updates);
        } else {
          editor._updateMotionAssignment(actionId, assignmentIndex, updates);
        }
        return;
      }
      return;
    }

    if (clickEvent.target.matches(".layout-remove-btn")) {
      editor._deleteLayoutAction(timelineCard.dataset.id);
      return;
    }
  };

  timeline.onchange = (changeEvent) => {
    const assignmentItem = changeEvent.target.closest(".motion-assignment-item");
    if (assignmentItem && changeEvent.target.matches(".assignment-delay-input")) {
      const actionId = assignmentItem.dataset.actionId;
      const assignmentIndex = parseInt(assignmentItem.dataset.assignmentIndex);
      const delayValue = parseFloat(changeEvent.target.value) || 0;

      const action = editor.projectFileState.actions.find(
        (actionItem) => actionItem.id === actionId
      );

      if (action && action.type === "layout") {
        editor._executeCommand((currentState) => {
          const layoutAction = currentState.actions.find(
            (actionItem) => actionItem.id === actionId
          );
          if (layoutAction) {
            layoutAction.delay = delayValue;
          }
        });
      } else {
        editor._updateMotionAssignment(actionId, assignmentIndex, {
          delay: delayValue,
        });
      }
      return;
    }

    if (changeEvent.target.matches(".layout-delay-input")) {
      const actionId = changeEvent.target.dataset.actionId;
      const delayValue = parseFloat(changeEvent.target.value) || 0;

      editor._executeCommand((currentState) => {
        const action = currentState.actions.find(
          (actionItem) => actionItem.id === actionId
        );
        if (action) {
          action.delay = delayValue;
        }
      });
      return;
    }

    const layoutCard = changeEvent.target.closest(".layout-item");
    if (layoutCard && changeEvent.target.matches("select, input")) {
      editor._updateLayoutActionProperty(layoutCard.dataset.id, changeEvent.target);
    }
  };
}
