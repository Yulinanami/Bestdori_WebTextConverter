import { editorService } from "@services/EditorService.js";

// 分配数据层：负责修改 editor 的 projectFileState（通过 _executeCommand 支持撤销）
export const assignmentStore = {
  // 在 talk action 上新增一条 motions 记录
  addMotionAssignment(editor, action, character) {
    editor._executeCommand((currentState) => {
      const currentAction = currentState.actions.find(
        (a) => a.id === action.id
      );
      if (!currentAction) return;

      if (!currentAction.motions) {
        currentAction.motions = [];
      }

      currentAction.motions.push({
        character: character.id,
        motion: "",
        expression: "",
        delay: 0,
      });
    });
  },

  // 更新 layout action 的 initialState（motion/expression）
  updateLayoutInitialState(editor, actionId, updates) {
    editor._executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (!action || action.type !== "layout") return;

      if (!action.initialState) {
        action.initialState = {};
      }

      Object.assign(action.initialState, updates);
    });
  },

  // 更新 talk action 的 motions[index]
  updateMotionAssignment(editor, actionId, assignmentIndex, updates) {
    editor._executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (!action || !action.motions || !action.motions[assignmentIndex])
        return;

      Object.assign(action.motions[assignmentIndex], updates);
    });
  },

  // 删除 talk action 的 motions[index]
  removeMotionAssignment(editor, actionId, assignmentIndex) {
    editor._executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (!action || !action.motions) return;

      action.motions.splice(assignmentIndex, 1);
    });
  },

  // 判断 action 是否已经有动作/表情/延迟数据（决定 UI 是否显示“设置”或直接显示分配区）
  actionHasExpressionData(action) {
    if (action.type === "talk") {
      return action.motions && action.motions.length > 0;
    }

    if (action.type === "layout") {
      const hasInitialState =
        action.initialState && Object.keys(action.initialState).length > 0;
      const hasDelay = typeof action.delay === "number";
      return hasInitialState || hasDelay;
    }
    return false;
  },

  // 确保 layout action 至少有一个 initialState（用于显示分配 UI）
  ensureLayoutAssignment(editor, actionId) {
    const action = editor.projectFileState.actions.find(
      (a) => a.id === actionId
    );
    if (!action || action.type !== "layout") return false;
    if (this.actionHasExpressionData(action)) return false;

    editor._executeCommand((currentState) => {
      const layoutAction = currentState.actions.find((a) => a.id === actionId);
      if (!layoutAction || layoutAction.type !== "layout") return;

      const baseState = layoutAction.initialState || {};
      layoutAction.initialState = {
        motion: baseState.motion || "",
        expression: baseState.expression || "",
      };
    });
    return true;
  },

  // 获取“已经登场的角色列表”（用于对话动作的角色选择）
  getStagedCharacters(editor) {
    const appearedCharacterNames = new Set();
    const characters = [];

    if (editor.projectFileState && editor.projectFileState.actions) {
      editor.projectFileState.actions.forEach((action) => {
        if (action.type === "layout" && action.layoutType === "appear") {
          const charName =
            action.characterName ||
            editorService.getCharacterNameById(action.characterId);
          if (charName && !appearedCharacterNames.has(charName)) {
            appearedCharacterNames.add(charName);
            characters.push({
              id: action.characterId,
              name: charName,
            });
          }
        }
      });
    }
    return characters;
  },
};
