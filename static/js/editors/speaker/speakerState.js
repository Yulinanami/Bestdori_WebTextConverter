import { ui } from "../../utils/uiUtils.js";
import { editorService } from "../../services/EditorService.js";

// 状态与数据处理相关的逻辑
export function attachSpeakerState(editor) {
  Object.assign(editor, {
    /**
     * 获取所有已使用的角色名称
     * @returns {Set<string>} 角色名称集合
     */
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

    // 更新对话的说话人分配（支持多选批量分配）
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

    // 从对话中移除指定说话人
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

    // 清空对话的所有说话人
    removeAllSpeakersFromAction(actionId) {
      this._executeCommand((currentState) => {
        const action = currentState.actions.find((a) => a.id === actionId);
        if (action) {
          action.speakers = [];
        }
      });
    },

    // 恢复默认说话人（重新解析文本自动分配说话人）
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

    _createActionFromSegment(index, text, speakers) {
      return {
        id: `action-id-${Date.now()}-${index}`,
        type: "talk",
        text: text,
        speakers: speakers,
      };
    },
  });
}
