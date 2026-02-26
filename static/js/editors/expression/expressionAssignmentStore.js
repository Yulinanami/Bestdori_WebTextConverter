import { editorService } from "@services/EditorService.js";

function shortValue(value) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  const text =
    typeof value === "string"
      ? value
      : JSON.stringify(value);
  if (text === undefined) return "undefined";
  if (text === "") return '""';
  return String(text).replace(/\s+/g, " ").trim();
}

function summarizeAssignmentItem(item) {
  if (!item) {
    return "none";
  }
  return `character=${item.character}, motion=${shortValue(
    item.motion
  )}, expression=${shortValue(item.expression)}, delay=${shortValue(item.delay)}`;
}

// 分配数据层：负责修改 editor 的 projectFileState（通过 executeCommand 支持撤销）
export const assignmentStore = {
  // 在 talk action 上新增一条 motions 记录
  addMotionAssignment(editor, action, character) {
    editor.markExpressionCardRender(action.id, {
      operation: "talk:add-character",
      detail: `character=${character.name}(ID:${character.id})`,
    });
    editor.baseEditor.executeCommand((currentState) => {
      const currentAction = currentState.actions.find(
        (actionItem) => actionItem.id === action.id
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
    const action = editor.projectFileState.actions.find(
      (actionItem) => actionItem.id === actionId
    );
    const beforeState = action?.initialState || {};
    const detail = Object.keys(updates)
      .map(
        (key) =>
          `${key}: ${shortValue(beforeState[key])} -> ${shortValue(updates[key])}`
      )
      .join(", ");
    editor.markExpressionCardRender(actionId, {
      operation: "layout:update-initial-state",
      detail,
    });
    editor.baseEditor.executeCommand((currentState) => {
      const action = currentState.actions.find(
        (actionItem) => actionItem.id === actionId
      );
      if (!action || action.type !== "layout") return;

      if (!action.initialState) {
        action.initialState = {};
      }

      Object.assign(action.initialState, updates);
    });
  },

  // 更新 talk action 的 motions[index]
  updateMotionAssignment(editor, actionId, assignmentIndex, updates) {
    const action = editor.projectFileState.actions.find(
      (actionItem) => actionItem.id === actionId
    );
    const beforeItem = action?.motions?.[assignmentIndex] || {};
    const detail = Object.keys(updates)
      .map(
        (key) =>
          `${key}: ${shortValue(beforeItem[key])} -> ${shortValue(updates[key])}`
      )
      .join(", ");
    editor.markExpressionCardRender(actionId, {
      operation: "talk:update-motion-assignment",
      detail,
    });
    editor.baseEditor.executeCommand((currentState) => {
      const action = currentState.actions.find(
        (actionItem) => actionItem.id === actionId
      );
      if (!action || !action.motions || !action.motions[assignmentIndex])
        return;

      Object.assign(action.motions[assignmentIndex], updates);
    });
  },

  // 删除 talk action 的 motions[index]
  removeMotionAssignment(editor, actionId, assignmentIndex) {
    const action = editor.projectFileState.actions.find(
      (actionItem) => actionItem.id === actionId
    );
    const removedItem = action?.motions?.[assignmentIndex];
    editor.markExpressionCardRender(actionId, {
      operation: "talk:remove-motion-assignment",
      detail: `removed=${summarizeAssignmentItem(removedItem)}`,
    });
    editor.baseEditor.executeCommand((currentState) => {
      const action = currentState.actions.find(
        (actionItem) => actionItem.id === actionId
      );
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
      (actionItem) => actionItem.id === actionId
    );
    if (!action || action.type !== "layout") return false;
    if (assignmentStore.actionHasExpressionData(action)) return false;

    editor.markExpressionCardRender(actionId, {
      operation: "layout:ensure-assignment",
      detail: "create initialState.motion/expression with empty default",
    });
    editor.baseEditor.executeCommand((currentState) => {
      const layoutAction = currentState.actions.find(
        (actionItem) => actionItem.id === actionId
      );
      if (!layoutAction || layoutAction.type !== "layout") return;

      const baseState = layoutAction.initialState || {};
      layoutAction.initialState = {
        motion: baseState.motion || "",
        expression: baseState.expression || "",
      };
    });
    return true;
  },

  // 清空 layout action 的 initialState / delay（恢复“设置动作/表情”按钮）。
  removeLayoutAssignment(editor, actionId) {
    const action = editor.projectFileState.actions.find(
      (actionItem) => actionItem.id === actionId
    );
    editor.markExpressionCardRender(actionId, {
      operation: "layout:remove-assignment",
      detail: `initialState=${shortValue(action?.initialState)}, delay=${shortValue(
        action?.delay
      )} -> removed`,
    });
    editor.baseEditor.executeCommand((currentState) => {
      const layoutAction = currentState.actions.find(
        (actionItem) => actionItem.id === actionId
      );
      if (!layoutAction || layoutAction.type !== "layout") return;
      delete layoutAction.initialState;
      delete layoutAction.delay;
    });
  },

  // 更新 layout action 的 delay。
  updateLayoutDelay(editor, actionId, delay) {
    const action = editor.projectFileState.actions.find(
      (actionItem) => actionItem.id === actionId
    );
    editor.markExpressionCardRender(actionId, {
      operation: "layout:update-delay",
      detail: `delay: ${shortValue(action?.delay)} -> ${shortValue(delay)}`,
    });
    editor.baseEditor.executeCommand((currentState) => {
      const layoutAction = currentState.actions.find(
        (actionItem) => actionItem.id === actionId
      );
      if (!layoutAction || layoutAction.type !== "layout") return;
      layoutAction.delay = delay;
    });
  },

  // 获取“已经登场的角色列表”（用于对话动作的角色选择）
  getStagedCharacters(editor) {
    const appearedCharacterNames = new Set();
    const characters = [];

    if (editor.projectFileState && editor.projectFileState.actions) {
      editor.projectFileState.actions.forEach((action) => {
        if (action.type === "layout" && action.layoutType === "appear") {
          const characterName =
            action.characterName ||
            editorService.configManager.getCharacterNameById(action.characterId);
          if (
            characterName &&
            !appearedCharacterNames.has(characterName)
          ) {
            appearedCharacterNames.add(characterName);
            characters.push({
              id: action.characterId,
              name: characterName,
            });
          }
        }
      });
    }
    return characters;
  },
};
