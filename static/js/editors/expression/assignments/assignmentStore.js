import { editorService } from "@services/EditorService.js";

/**
 * 与动作/表情分配相关的状态更新逻辑。
 * 所有函数接受 editor 实例，便于解耦和复用。
 */
export const assignmentStore = {
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

  updateMotionAssignment(editor, actionId, assignmentIndex, updates) {
    editor._executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (!action || !action.motions || !action.motions[assignmentIndex])
        return;

      Object.assign(action.motions[assignmentIndex], updates);
    });
  },

  removeMotionAssignment(editor, actionId, assignmentIndex) {
    editor._executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (!action || !action.motions) return;

      action.motions.splice(assignmentIndex, 1);
    });
  },

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
