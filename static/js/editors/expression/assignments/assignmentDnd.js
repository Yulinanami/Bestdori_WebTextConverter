import { DOMUtils } from "@utils/DOMUtils.js";

/**
 * 负责分配项拖放区的 Sortable 初始化。
 */
export const assignmentDnd = {
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

        onAdd: (evt) => {
          const value = evt.item ? evt.item.textContent.trim() : null;
          const dropZone = evt.to;
          const assignmentItem = dropZone.closest(".motion-assignment-item");

          evt.item.remove();

          if (value && assignmentItem) {
            const actionId = assignmentItem.dataset.actionId;
            const assignmentIndex = parseInt(
              assignmentItem.dataset.assignmentIndex
            );
            const type = dropZone.dataset.type;

            const valueElement = dropZone.querySelector(".drop-zone-value");
            if (valueElement) {
              valueElement.textContent = value;
            }

            const clearBtn = dropZone.querySelector(".clear-state-btn");
            if (clearBtn) {
              DOMUtils.toggleDisplay(clearBtn, true);
            }

            const updates = {};
            updates[type] = value;

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
