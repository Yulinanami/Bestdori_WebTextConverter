import { ui } from "@utils/uiUtils.js";
import { editorService } from "@services/EditorService.js";

// 读写说话人、重置为默认等。
export function attachSpeakerState(editor) {
  Object.assign(editor, {
    // 统计当前项目里出现过哪些角色（用于右侧列表高亮）
    _getUsedCharacterIds() {
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

    // 给某条对话（或当前多选的多条对话）添加一个说话人
    updateSpeakerAssignment(actionId, newSpeaker) {
      const selectedIds = editorService.selectionManager.getSelectedIds();
      const targetIds = selectedIds.length > 0 ? selectedIds : [actionId];
      this._executeCommand((currentState) => {
        targetIds.forEach((id) => {
          const actionToUpdate = currentState.actions.find((a) => a.id === id);
          if (actionToUpdate) {
            const speakerExists = actionToUpdate.speakers.some(
              (s) => s.characterId === newSpeaker.characterId
            );
            if (!speakerExists) {
              actionToUpdate.speakers.push(newSpeaker);
            }
          }
        });
      });

      editorService.clearSelection();
      this.domCache.canvas?.dispatchEvent(
        new CustomEvent("selectionchange", { detail: { selectedIds: [] } })
      );
    },

    // 从一条对话里移除某个说话人
    removeSpeakerFromAction(actionId, characterIdToRemove) {
      this._executeCommand((currentState) => {
        const action = currentState.actions.find((a) => a.id === actionId);
        if (action) {
          action.speakers = action.speakers.filter(
            (s) => s.characterId !== characterIdToRemove
          );
        }
      });
    },

    // 清空一条对话的所有说话人（变成旁白）
    removeAllSpeakersFromAction(actionId) {
      this._executeCommand((currentState) => {
        const action = currentState.actions.find((a) => a.id === actionId);
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

      const resetBtn = document.getElementById("resetSpeakersBtn");
      const originalText = resetBtn?.textContent;
      if (resetBtn) resetBtn.textContent = "恢复中...";

      try {
        const rawText = document.getElementById("inputText").value;
        const response = await axios.post("/api/segment-text", {
          text: rawText,
        });
        const defaultState = this._createProjectFileFromSegments(
          response.data.segments
        );
        this._executeCommand((currentState) => {
          Object.assign(currentState, defaultState);
        });

        ui.showStatus("已恢复默认说话人。", "success");
      } catch (error) {
        ui.showStatus(`恢复失败: ${error.message}`, "error");
      } finally {
        if (resetBtn && originalText) resetBtn.textContent = originalText;
      }
    },
  });
}
