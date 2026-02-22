import { DOMUtils } from "@utils/DOMUtils.js";

// 分配区拖拽：把“动作/表情库”的 item 拖进 drop-zone 后写回数据
export const assignmentDnd = {
  // 给某个分配项里的所有 drop-zone 初始化 Sortable
  initSortableForAssignmentZones(
    editor,
    assignmentElement,
    isLayoutCard = false
  ) {
    assignmentElement.querySelectorAll(".drop-zone").forEach((zone) => {
      new Sortable(zone, {
        group: {
          name: zone.dataset.type,
          put: function (_to, _from, dragEl) {
            return dragEl.classList.contains("draggable-item");
          },
        },
        animation: 150,

        onAdd: (sortableEvent) => {
          const droppedValue = sortableEvent.item
            ? sortableEvent.item.textContent.trim()
            : null;
          const dropZone = sortableEvent.to;
          const assignmentItem = dropZone.closest(".motion-assignment-item");

          sortableEvent.item.remove();

          if (droppedValue && assignmentItem) {
            const actionId = assignmentItem.dataset.actionId;
            const assignmentIndex = parseInt(
              assignmentItem.dataset.assignmentIndex
            );
            const type = dropZone.dataset.type;

            const valueElement = dropZone.querySelector(".drop-zone-value");
            if (valueElement) {
              valueElement.textContent = droppedValue;
            }

            const clearButton = dropZone.querySelector(".clear-state-btn");
            if (clearButton) {
              DOMUtils.toggleDisplay(clearButton, true);
            }

            const updates = {};
            updates[type] = droppedValue;

            if (isLayoutCard) {
              editor._updateLayoutInitialState(actionId, updates);
            } else {
              editor._updateMotionAssignment(
                actionId,
                assignmentIndex,
                updates
              );
            }
          }
        },
      });
    });
  },
};
