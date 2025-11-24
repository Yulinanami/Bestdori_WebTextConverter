import { DOMUtils } from "@utils/DOMUtils.js";

/**
 * 为编辑器绑定时间轴的点击/变更事件。
 * 提供独立模块方便与渲染逻辑解耦。
 */
export function bindTimelineEvents(editor) {
  const timeline = editor.domCache.timeline;
  if (!timeline) return;

  timeline.onclick = (e) => {
    const card = e.target.closest(".timeline-item");
    if (!card) return;

    if (e.target.matches(".setup-expressions-btn")) {
      const actionId = card.dataset.id;
      const action = editor.projectFileState.actions.find(
        (a) => a.id === actionId
      );

      const footer = card.querySelector(".timeline-item-footer");

      if (action && action.type === "layout") {
        editor.showExpressionSetupUI(card);
        return;
      }

      const characterSelector = footer?.querySelector(
        ".motion-character-selector"
      );
      if (characterSelector) {
        const isHidden = characterSelector.style.display === "none";
        characterSelector.style.display = isHidden ? "block" : "none";
      } else {
        editor.showExpressionSetupUI(card);
        const newSelector = footer?.querySelector(".motion-character-selector");
        if (newSelector) {
          newSelector.style.display = "block";
        }
      }
      return;
    }

    if (
      e.target.matches(".character-selector-item") ||
      e.target.closest(".character-selector-item")
    ) {
      const characterItem = e.target.closest(".character-selector-item");
      if (characterItem) {
        const characterId = parseInt(characterItem.dataset.characterId);
        const characterName = characterItem.dataset.characterName;
        const actionId = card.dataset.id;
        const action = editor.projectFileState.actions.find(
          (a) => a.id === actionId
        );
        if (action) {
          editor._addMotionAssignment(action, {
            id: characterId,
            name: characterName,
          });
          const footer = card.querySelector(".timeline-item-footer");
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

    if (e.target.matches(".assignment-remove-btn")) {
      const assignmentItem = e.target.closest(".motion-assignment-item");
      if (assignmentItem) {
        const assignmentIndex = parseInt(
          assignmentItem.dataset.assignmentIndex
        );
        const actionId = card.dataset.id;
        const action = editor.projectFileState.actions.find(
          (a) => a.id === actionId
        );
        if (action && action.type === "layout") {
          editor._executeCommand((currentState) => {
            const layoutAction = currentState.actions.find(
              (a) => a.id === actionId
            );
            if (layoutAction) {
              layoutAction.initialState = {};
              delete layoutAction.delay;
            }
          });
        } else {
          editor._removeMotionAssignment(actionId, assignmentIndex);
        }
      }
      return;
    }

    if (e.target.matches(".clear-state-btn")) {
      const dropZone = e.target.closest(".drop-zone");
      const assignmentItem = e.target.closest(".motion-assignment-item");
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
        DOMUtils.toggleDisplay(e.target, false);

        const action = editor.projectFileState.actions.find(
          (a) => a.id === actionId
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

    if (e.target.matches(".layout-remove-btn")) {
      editor._deleteLayoutAction(card.dataset.id);
      return;
    }
  };

  timeline.onchange = (e) => {
    const assignmentItem = e.target.closest(".motion-assignment-item");
    if (assignmentItem && e.target.matches(".assignment-delay-input")) {
      const actionId = assignmentItem.dataset.actionId;
      const assignmentIndex = parseInt(assignmentItem.dataset.assignmentIndex);
      const delayValue = parseFloat(e.target.value) || 0;

      const action = editor.projectFileState.actions.find(
        (a) => a.id === actionId
      );

      if (action && action.type === "layout") {
        editor._executeCommand((currentState) => {
          const layoutAction = currentState.actions.find(
            (a) => a.id === actionId
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

    if (e.target.matches(".layout-delay-input")) {
      const actionId = e.target.dataset.actionId;
      const delayValue = parseFloat(e.target.value) || 0;

      editor._executeCommand((currentState) => {
        const action = currentState.actions.find((a) => a.id === actionId);
        if (action) {
          action.delay = delayValue;
        }
      });
      return;
    }

    const card = e.target.closest(".layout-item");
    if (card && e.target.matches("select, input")) {
      editor._updateLayoutActionProperty(card.dataset.id, e.target);
    }
  };
}
