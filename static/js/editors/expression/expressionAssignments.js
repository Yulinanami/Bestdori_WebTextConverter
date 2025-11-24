import { assignmentRenderer } from "@editors/expression/assignments/assignmentRenderer.js";
import { assignmentStore } from "@editors/expression/assignments/assignmentStore.js";
import { assignmentDnd } from "@editors/expression/assignments/assignmentDnd.js";

// 动作/表情分配相关的渲染与状态操作
export function attachExpressionAssignments(editor) {
  Object.assign(editor, {
    showExpressionSetupUI(cardElement) {
      assignmentRenderer.showExpressionSetupUI(editor, cardElement);
    },

    _createCharacterSelector(action) {
      return assignmentRenderer.createCharacterSelector(editor, action);
    },

    _addMotionAssignment(action, character) {
      assignmentStore.addMotionAssignment(editor, action, character);
    },

    _createAssignmentItem(action, motionData, index, isLayoutCard = false) {
      return assignmentRenderer.createAssignmentItem(
        editor,
        action,
        motionData,
        index,
        isLayoutCard
      );
    },

    _initSortableForAssignmentZones(assignmentElement, isLayoutCard = false) {
      assignmentDnd.initSortableForAssignmentZones(
        editor,
        assignmentElement,
        isLayoutCard
      );
    },

    _updateLayoutInitialState(actionId, updates) {
      assignmentStore.updateLayoutInitialState(editor, actionId, updates);
    },

    _updateMotionAssignment(actionId, assignmentIndex, updates) {
      assignmentStore.updateMotionAssignment(
        editor,
        actionId,
        assignmentIndex,
        updates
      );
    },

    _removeMotionAssignment(actionId, assignmentIndex) {
      assignmentStore.removeMotionAssignment(editor, actionId, assignmentIndex);
    },

    _actionHasExpressionData(action) {
      return assignmentStore.actionHasExpressionData(action);
    },

    _ensureLayoutAssignment(actionId) {
      return assignmentStore.ensureLayoutAssignment(editor, actionId);
    },

    _getStagedCharacters() {
      return assignmentStore.getStagedCharacters(editor);
    },
  });
}
