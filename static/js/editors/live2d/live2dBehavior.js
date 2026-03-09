// Live2D 布局编辑
import { ui } from "@utils/uiUtils.js";
import { state } from "@managers/stateManager.js";
import { positionManager } from "@managers/positionManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";

// 创建一条布局动作
function createLayoutAction(id, characterId, characterName, layoutType, costume, position) {
  return {
    id,
    type: "layout",
    characterId,
    characterName,
    layoutType,
    costume,
    position: {
      from: { ...position },
      to: { ...position },
    },
    initialState: {},
  };
}

// 删掉所有布局动作
function removeLayoutActions(actions) {
  return actions.filter((actionItem) => actionItem.type !== "layout");
}

// 给编辑器添加布局方法
export function attachLive2DBehavior(editor) {
  Object.assign(editor, {
    // 切换后续布局模式
    toggleSubsequentMode() {
      editor.nextMode =
        editor.nextMode === "move" ? "hide" : "move";
      storageService.save(
        STORAGE_KEYS.LIVE2D_SUBSEQUENT_MODE,
        editor.nextMode
      );
      editor.updateSubsequentMode();
    },

    // 刷新后续模式按钮文字
    updateSubsequentMode() {
      if (editor.domCache.modeText) {
        const modeText =
          editor.nextMode === "move" ? "移动" : "退场";
        editor.domCache.modeText.textContent = `后续: ${modeText}`;
      }
    },

    // 清空所有布局
    async clearAllLayouts() {
      if (!confirm("确定要清空所有布局吗？此操作可以撤销。")) return;
      await ui.withButtonLoading(
        "resetLayoutsBtn",
        async () => {
          editor.executeCommand((currentState) => {
            currentState.actions = removeLayoutActions(currentState.actions);
          });
          ui.showStatus("已清空所有布局。", "success");
        },
        "清空中..."
      );
    },

    // 自动生成布局
    applyAutoLayout() {
      if (
        !confirm(
          "这将清空所有现有的Live2D布局，并根据角色的首次发言自动生成新的登场布局。确定要继续吗？"
        )
      ) {
        return;
      }
      editor.executeCommand((currentState) => {
        // 先清空旧布局
        currentState.actions = removeLayoutActions(currentState.actions);
        const seenChars = new Set();
        const newActions = [];
        let layoutCounter = 0;

        // 先顺着剧情扫描 首次发言的角色前面补一条登场布局
        // 第一次说话的角色自动登场
        currentState.actions.forEach((action) => {
          if (action.type === "talk" && action.speakers.length > 0) {
            action.speakers.forEach((speaker) => {
              if (!seenChars.has(speaker.name)) {
                seenChars.add(speaker.name);
                const defaultCostume =
                  state.currentCostumes[speaker.name] || "";
                const positionConfig =
                  positionManager.findPositionConfig(
                    speaker.name,
                    seenChars.size - 1,
                  );
                newActions.push(
                  createLayoutAction(
                    `layout-action-${Date.now()}-${speaker.characterId}-${layoutCounter++}`,
                    speaker.characterId,
                    speaker.name,
                    "appear",
                    defaultCostume,
                    {
                      side: positionConfig.position,
                      offsetX: positionConfig.offset,
                    }
                  )
                );
              }
            });
          }
          newActions.push(action);
        });
        currentState.actions = newActions;
      });
      ui.showStatus("已应用智能布局！", "success");
    },

    // 插入一条布局动作
    insertLayoutAction(characterId, characterName, index) {
      const layoutActionId = `layout-action-${Date.now()}-${Math.random()}`;
      const previousState = editor.findPrevCharacterState(
        editor.projectFileState?.actions || [],
        characterName,
        index
      );
      const layoutType = previousState.onStage
        ? editor.nextMode
        : "appear";
      const costumeToUse =
        previousState.lastCostume ||
        state.currentCostumes[characterName] ||
        "";
      const defaultPosition = editor.findDefaultPos(characterName);
      const fromPosition = previousState.lastPosition
        ? { ...previousState.lastPosition }
        : { side: defaultPosition.position, offsetX: defaultPosition.offset };
      editor.markLayoutMutation(layoutActionId, "add", {
        source: "ui",
        detail: `type=layout, character=${characterName}, layoutType=${layoutType}, costume=${costumeToUse}, from=${JSON.stringify(
          fromPosition
        )}`,
      });
      editor.executeCommand((currentState) => {
        currentState.actions.splice(
          index,
          0,
          createLayoutAction(
            layoutActionId,
            characterId,
            characterName,
            layoutType,
            costumeToUse,
            fromPosition
          )
        );
      });
    },

    // 读取当前项目里出现过的角色
    listUsedIds() {
      const usedNames = new Set();
      editor.projectFileState?.actions?.forEach((action) => {
        if (action.type === "layout" && action.characterName) {
          usedNames.add(action.characterName);
        }
      });
      return usedNames;
    },

    // 读取角色默认位置
    findDefaultPos(characterName) {
      const manualPosition = positionManager.manualPositions[characterName];
      if (!positionManager.autoPositionMode && manualPosition) {
        return {
          position: manualPosition.position || "center",
          offset: manualPosition.offset || 0,
        };
      }
      return { position: "center", offset: 0 };
    },

    // 往前推角色状态
    findPrevCharacterState(actions, characterName, startIndex) {
      let onStage = false;
      let lastPosition = null;
      let lastCostume = null;

      // 从开头一路推到插入点 算出角色当前位置和服装
      // 从头开始看角色状态怎么变
      for (let actionIndex = 0; actionIndex < startIndex; actionIndex++) {
        const action = actions[actionIndex];
        if (
          action &&
          action.type === "layout" &&
          action.characterName === characterName
        ) {
          if (action.layoutType === "appear" || action.layoutType === "move") {
            onStage = true;
            if (action.position?.to) {
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
