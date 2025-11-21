import { ui } from "../../utils/uiUtils.js";
import { editorService } from "../../services/EditorService.js";

// 状态与数据相关的逻辑（不包含 UI 事件绑定）
export function attachLive2dState(editor, _baseEditor) {
  Object.assign(editor, {
    // 获取所有已使用的角色名称集合（在布局中出现的角色）
    _getUsedCharacterIds() {
      const usedNames = new Set();
      if (editor.projectFileState && editor.projectFileState.actions) {
        editor.projectFileState.actions.forEach((action) => {
          if (action.type === "layout" && action.characterName) {
            usedNames.add(action.characterName);
          }
        });
      }
      return usedNames;
    },

    async _clearAllLayouts() {
      if (!confirm("确定要清空所有布局吗？此操作可以撤销。")) {
        return;
      }

      const resetBtn = document.getElementById("resetLayoutsBtn");
      const originalText = resetBtn?.textContent;
      if (resetBtn) resetBtn.textContent = "清空中...";

      try {
        editor._executeCommand((currentState) => {
          currentState.actions = currentState.actions.filter(
            (a) => a.type !== "layout"
          );
        });
        ui.showStatus("已清空所有布局。", "success");
      } finally {
        if (resetBtn && originalText) resetBtn.textContent = originalText;
      }
    },

    /**
     * 快速布局
     * 1. 清空所有现有布局动作
     * 2. 遍历对话动作,找到每个角色的首次发言
     * 3. 在首次发言前插入登场动作(appear)
     * 4. 根据配置自动设置位置和服装
     */
    _applyAutoLayout() {
      if (
        !confirm(
          "这将清空所有现有的Live2D布局，并根据角色的首次发言自动生成新的登场布局。确定要继续吗？"
        )
      ) {
        return;
      }
      editor._executeCommand((currentState) => {
        // 清空现有布局
        currentState.actions = currentState.actions.filter(
          (a) => a.type !== "layout"
        );
        const appearedCharacterNames = new Set();
        const newActions = [];
        let layoutCounter = 0;

        // 遍历对话,为首次发言的角色创建登场动作
        currentState.actions.forEach((action) => {
          if (action.type === "talk" && action.speakers.length > 0) {
            action.speakers.forEach((speaker) => {
              if (!appearedCharacterNames.has(speaker.name)) {
                appearedCharacterNames.add(speaker.name);
                const defaultCostume = editor._getDefaultCostume(speaker.name);
                const positionConfig =
                  editorService.positionManager.getCharacterPositionConfig(
                    speaker.name,
                    appearedCharacterNames.size - 1
                  );

                const newLayoutAction = {
                  id: `layout-action-${Date.now()}-${
                    speaker.characterId
                  }-${layoutCounter++}`,
                  type: "layout",
                  characterId: speaker.characterId,
                  characterName: speaker.name,
                  layoutType: "appear",
                  costume: defaultCostume,
                  position: {
                    from: {
                      side: positionConfig.position,
                      offsetX: positionConfig.offset,
                    },
                    to: {
                      side: positionConfig.position,
                      offsetX: positionConfig.offset,
                    },
                  },
                  initialState: {},
                };

                newActions.push(newLayoutAction);
              }
            });
          }
          newActions.push(action);
        });
        currentState.actions = newActions;
      });
      ui.showStatus("已应用智能布局！", "success");
    },

    /**
     * 插入布局动作(拖拽角色到时间轴时调用)
     * 根据角色的历史状态智能判断动作类型:
     * - 角色未登场 -> appear(登场)
     * - 角色已登场 -> 根据 subsequentLayoutMode 设置为 move(移动) 或 hide(退场)
     * 自动继承上一次的服装和位置
     */
    insertLayoutAction(characterId, characterName, index) {
      editor._executeCommand((currentState) => {
        const previousState = editor._getCharacterStateAtIndex(
          currentState.actions,
          characterName,
          index
        );
        const layoutType = previousState.onStage
          ? editor.subsequentLayoutMode
          : "appear";
        const costumeToUse =
          previousState.lastCostume || editor._getDefaultCostume(characterName);
        const defaultPosition = editor._getDefaultPosition(characterName);
        const fromPosition = previousState.lastPosition
          ? { ...previousState.lastPosition }
          : { side: defaultPosition.position, offsetX: defaultPosition.offset };

        const newLayoutAction = {
          id: `layout-action-${Date.now()}`,
          type: "layout",
          characterId,
          characterName,
          layoutType: layoutType,
          costume: costumeToUse,
          position: {
            from: fromPosition,
            to: { ...fromPosition },
          },
          initialState: {},
        };
        currentState.actions.splice(index, 0, newLayoutAction);
      });
    },

    // 获取角色的默认服装ID
    _getDefaultCostume(characterName) {
      return editorService.state.get("currentCostumes")[characterName] || "";
    },

    // 获取角色的默认位置配置（自动模式或手动模式）
    _getDefaultPosition(characterName) {
      const pm = editorService.positionManager;
      if (!pm.autoPositionMode && pm.manualPositions[characterName]) {
        return {
          position: pm.manualPositions[characterName].position || "center",
          offset: pm.manualPositions[characterName].offset || 0,
        };
      }
      return { position: "center", offset: 0 };
    },

    /**
     * 获取角色在指定索引位置的状态
     * 通过回溯历史布局动作,追踪角色的登场状态、位置和服装
     * @param {Array} actions - 动作数组
     * @param {string} characterName - 角色名
     * @param {number} startIndex - 检查的起始索引
     * @returns {Object} { onStage: 是否在场, lastPosition: 最后位置, lastCostume: 最后服装 }
     */
    _getCharacterStateAtIndex(actions, characterName, startIndex) {
      let onStage = false;
      let lastPosition = null;
      let lastCostume = null;

      // 从头遍历到指定索引,追踪角色状态变化
      for (let i = 0; i < startIndex; i++) {
        const action = actions[i];
        if (
          action &&
          action.type === "layout" &&
          action.characterName === characterName
        ) {
          if (action.layoutType === "appear" || action.layoutType === "move") {
            onStage = true;
            if (action.position && action.position.to) {
              lastPosition = {
                side: action.position.to.side,
                offsetX: action.position.to.offsetX,
              };
            }
            if (action.costume) {
              lastCostume = action.costume;
            }
          } else if (action.layoutType === "hide") {
            onStage = false;
            lastPosition = null;
          }
        }
      }
      return { onStage, lastPosition, lastCostume };
    },
  });
}
