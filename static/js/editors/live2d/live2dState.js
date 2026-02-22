import { ui } from "@utils/uiUtils.js";
import { editorService } from "@services/EditorService.js";

// 自动布局、插入布局动作、清空布局等
export function attachLive2DState(editor, _baseEditor) {
  Object.assign(editor, {
    // 清空所有布局动作（只保留对话动作）
    async clearAllLayouts() {
      if (!confirm("确定要清空所有布局吗？此操作可以撤销。")) {
        return;
      }

      const resetButton = document.getElementById("resetLayoutsBtn");
      const originalText = resetButton?.textContent;
      if (resetButton) resetButton.textContent = "清空中...";

      try {
        editor.executeCommand((currentState) => {
          currentState.actions = currentState.actions.filter(
            (actionItem) => actionItem.type !== "layout"
          );
        });
        ui.showStatus("已清空所有布局。", "success");
      } finally {
        if (resetButton && originalText) resetButton.textContent = originalText;
      }
    },

    // 一键自动布局：根据每个角色的首次发言，自动插入登场布局
    applyAutoLayout() {
      if (
        !confirm(
          "这将清空所有现有的Live2D布局，并根据角色的首次发言自动生成新的登场布局。确定要继续吗？"
        )
      ) {
        return;
      }
      editor.executeCommand((currentState) => {
        // 清空现有布局
        currentState.actions = currentState.actions.filter(
          (actionItem) => actionItem.type !== "layout"
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
                const defaultCostume = editor.getDefaultCostume(speaker.name);
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

    // 插入一条布局动作（拖拽角色到时间轴时用，会自动决定 appear/move/hide）
    insertLayoutAction(characterId, characterName, index) {
      editor.executeCommand((currentState) => {
        const previousState = editor.getCharacterStateAtIndex(
          currentState.actions,
          characterName,
          index
        );
        const layoutType = previousState.onStage
          ? editor.subsequentLayoutMode
          : "appear";
        const costumeToUse =
          previousState.lastCostume || editor.getDefaultCostume(characterName);
        const defaultPosition = editor.getDefaultPosition(characterName);
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

    // 统计当前项目里出现过哪些角色（用于右侧列表高亮）
    getUsedCharacterIds() {
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

    // 获取某角色的默认服装（来自当前服装配置）
    getDefaultCostume(characterName) {
      return editorService.state.get("currentCostumes")[characterName] || "";
    },

    // 获取某角色的默认位置（优先手动位置，否则返回 center/0）
    getDefaultPosition(characterName) {
      const positionManager = editorService.positionManager;
      if (
        !positionManager.autoPositionMode &&
        positionManager.manualPositions[characterName]
      ) {
        return {
          position:
            positionManager.manualPositions[characterName].position || "center",
          offset: positionManager.manualPositions[characterName].offset || 0,
        };
      }
      return { position: "center", offset: 0 };
    },

    // 回溯到 startIndex 之前：推断角色是否在场、最后位置、最后服装
    getCharacterStateAtIndex(actions, characterName, startIndex) {
      let onStage = false;
      let lastPosition = null;
      let lastCostume = null;

      // 从头遍历到指定索引,追踪角色状态变化
      for (let actionIndex = 0; actionIndex < startIndex; actionIndex++) {
        const action = actions[actionIndex];
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
