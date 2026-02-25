import { ui } from "@utils/uiUtils.js";
import { editorService } from "@services/EditorService.js";

// 读写说话人、重置为默认等。
export function attachSpeakerState(editor) {
  Object.assign(editor, {
    // 给某条对话（或当前多选的多条对话）添加一个说话人
    updateSpeakerAssignment(actionId, newSpeaker, actionIndex) {
      const selectedIds = Array.from(editorService.selectionManager.selectedIds);
      const targetIds = selectedIds.length > 0 ? selectedIds : [actionId];
      const targetActionIndexMap = new Map();

      if (Number.isInteger(actionIndex)) {
        targetActionIndexMap.set(actionId, actionIndex);
      }

      if (selectedIds.length > 0 && this.domCache.canvas) {
        const selectedCards = this.domCache.canvas.querySelectorAll(
          ".dialogue-item.is-selected, .layout-item.is-selected"
        );
        selectedCards.forEach((cardElement) => {
          const targetActionId = cardElement.dataset.id;
          const targetActionIndex = Number.parseInt(
            cardElement.dataset.actionIndex,
            10
          );
          if (targetActionId && Number.isInteger(targetActionIndex)) {
            targetActionIndexMap.set(targetActionId, targetActionIndex);
          }
        });
      }

      this.baseEditor.executeCommand((currentState) => {
        const addSpeakerIfNeeded = (actionToUpdate) => {
          const speakerExists = actionToUpdate.speakers.some(
            (speaker) => speaker.characterId === newSpeaker.characterId
          );
          if (!speakerExists) {
            actionToUpdate.speakers.push(newSpeaker);
          }
        };

        if (selectedIds.length === 0 && Number.isInteger(actionIndex)) {
          const actionToUpdate = currentState.actions[actionIndex];
          if (actionToUpdate && actionToUpdate.id === actionId) {
            addSpeakerIfNeeded(actionToUpdate);
          }
          return;
        }

        const unresolvedTargetIds = [];
        targetIds.forEach((targetActionId) => {
          const targetActionIndex = targetActionIndexMap.get(targetActionId);
          if (Number.isInteger(targetActionIndex)) {
            const actionToUpdate = currentState.actions[targetActionIndex];
            if (actionToUpdate && actionToUpdate.id === targetActionId) {
              addSpeakerIfNeeded(actionToUpdate);
              return;
            }
          }
          unresolvedTargetIds.push(targetActionId);
        });

        if (unresolvedTargetIds.length === 0) {
          return;
        }

        const actionMap = new Map(
          currentState.actions.map((actionItem) => [actionItem.id, actionItem])
        );
        unresolvedTargetIds.forEach((targetActionId) => {
          const actionToUpdate = actionMap.get(targetActionId);
          if (actionToUpdate) {
            addSpeakerIfNeeded(actionToUpdate);
          }
        });
      });

      editorService.selectionManager.selectedIds.clear();
      this.domCache.canvas?.dispatchEvent(
        new CustomEvent("selectionchange", { detail: { selectedIds: [] } })
      );
    },

    // 从一条对话里移除某个说话人
    removeSpeakerFromAction(actionId, characterIdToRemove) {
      this.baseEditor.executeCommand((currentState) => {
        const action = currentState.actions.find(
          (actionItem) => actionItem.id === actionId
        );
        if (action) {
          action.speakers = action.speakers.filter(
            (speaker) => speaker.characterId !== characterIdToRemove
          );
        }
      });
    },

    // 清空一条对话的所有说话人（变成旁白）
    removeAllSpeakersFromAction(actionId) {
      this.baseEditor.executeCommand((currentState) => {
        const action = currentState.actions.find(
          (actionItem) => actionItem.id === actionId
        );
        if (action) {
          action.speakers = [];
        }
      });
    },

    // 恢复默认：按原始文本重新分段并重建项目（可撤销）
    async reset() {
      if (!confirm("确定要恢复默认说话人吗？此操作可以撤销。")) {
        return;
      }

      const resetButton = document.getElementById("resetSpeakersBtn");
      const originalText = resetButton?.textContent;
      if (resetButton) resetButton.textContent = "恢复中...";

      try {
        const rawText = document.getElementById("inputText").value;
        const response = await axios.post("/api/segment-text", {
          text: rawText,
        });
        const defaultState = this.createProjectFileFromSegments(
          response.data.segments
        );
        this.baseEditor.executeCommand((currentState) => {
          Object.assign(currentState, defaultState);
        });

        ui.showStatus("已恢复默认说话人。", "success");
      } catch (error) {
        ui.showStatus(`恢复失败: ${error.message}`, "error");
      } finally {
        if (resetButton && originalText) resetButton.textContent = originalText;
      }
    },

    // 统计当前项目里出现过哪些角色（用于右侧列表高亮）
    getUsedCharacterIds() {
      const usedNames = new Set();
      if (this.projectFileState && this.projectFileState.actions) {
        this.projectFileState.actions.forEach((action) => {
          if (action && action.type === "talk" && action.speakers) {
            action.speakers.forEach((speaker) => {
              if (speaker.name) {
                usedNames.add(speaker.name);
              }
            });
          }
        });
      }
      return usedNames;
    },
  });
}
