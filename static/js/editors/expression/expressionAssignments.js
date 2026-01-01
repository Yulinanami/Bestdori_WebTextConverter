import { assignmentRenderer } from "@editors/expression/assignments/assignmentRenderer.js";
import { assignmentStore } from "@editors/expression/assignments/assignmentStore.js";
import { assignmentDnd } from "@editors/expression/assignments/assignmentDnd.js";

// 给 expressionEditor 注入“分配区能力”：渲染分配 UI，并更新动作/表情数据
export function attachExpressionAssignments(editor) {
  Object.assign(editor, {
    // 在卡片底部显示“动作/表情分配”区域
    showExpressionSetupUI(cardElement) {
      assignmentRenderer.showExpressionSetupUI(editor, cardElement);
    },

    // 创建“选择角色”的面板（用于给某条对话添加分配项）
    _createCharacterSelector(action) {
      return assignmentRenderer.createCharacterSelector(editor, action);
    },

    // 给某条 action 新增一个动作/表情分配项
    _addMotionAssignment(action, character) {
      assignmentStore.addMotionAssignment(editor, action, character);
    },

    // 创建一条“分配项”DOM（包含动作区/表情区/延迟/删除按钮）
    _createAssignmentItem(action, motionData, index, isLayoutCard = false) {
      return assignmentRenderer.createAssignmentItem(
        editor,
        action,
        motionData,
        index,
        isLayoutCard
      );
    },

    // 给分配项里的拖放区初始化 Sortable（把动作/表情从右侧库拖进来）
    _initSortableForAssignmentZones(assignmentElement, isLayoutCard = false) {
      assignmentDnd.initSortableForAssignmentZones(
        editor,
        assignmentElement,
        isLayoutCard
      );
    },

    // 更新 layout 卡片的初始动作/表情（initialState）
    _updateLayoutInitialState(actionId, updates) {
      assignmentStore.updateLayoutInitialState(editor, actionId, updates);
    },

    // 更新 talk 卡片的某一条分配项（motions[index]）
    _updateMotionAssignment(actionId, assignmentIndex, updates) {
      assignmentStore.updateMotionAssignment(
        editor,
        actionId,
        assignmentIndex,
        updates
      );
    },

    // 删除 talk 卡片的一条分配项
    _removeMotionAssignment(actionId, assignmentIndex) {
      assignmentStore.removeMotionAssignment(editor, actionId, assignmentIndex);
    },

    // 判断某条 action 是否已经设置过动作/表情/延迟（用于决定 footer 显示什么）
    _actionHasExpressionData(action) {
      return assignmentStore.actionHasExpressionData(action);
    },

    // 给 layout action 创建一个最基础的 initialState（避免空面板）
    _ensureLayoutAssignment(actionId) {
      return assignmentStore.ensureLayoutAssignment(editor, actionId);
    },

    // 计算“当前在场角色列表”（用于对话动作的角色选择）
    _getStagedCharacters() {
      return assignmentStore.getStagedCharacters(editor);
    },
  });
}
