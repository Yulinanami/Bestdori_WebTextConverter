import { DragHelper } from "@editors/common/DragHelper.js";
import { ScrollAnimationMixin } from "@mixins/ScrollAnimationMixin.js";

// 拖角色到卡片、拖卡片排序、拖拽时自动滚动
export function attachSpeakerDrag(editor, baseEditor) {
  Object.assign(editor, {
    // 拖拽时自动滚动：把事件转交给 ScrollAnimationMixin
    handleDragScrolling: (dragEvent) => {
      const containers = [
        editor.domCache.canvas,
        editor.domCache.characterList,
      ];
      ScrollAnimationMixin.handleDragScrolling.call(
        editor,
        dragEvent,
        containers
      );
    },

    // 初始化拖拽：角色列表可拖出，画布可接收并可排序
    initDragAndDrop() {
      const characterList = editor.domCache.characterList;
      const canvas = editor.domCache.canvas;
      if (!characterList || !canvas) return;

      const hasCharacterSortable = editor.sortableInstances.some(
        (instance) => instance?.el === characterList
      );
      const hasCanvasSortable = editor.sortableInstances.some(
        (instance) => instance?.el === canvas
      );

      // 角色列表的Sortable配置
      if (!hasCharacterSortable) {
        editor.sortableInstances.push(
          new Sortable(characterList, {
            group: {
              name: "shared-speakers",
              pull: "clone", // 拖出时克隆
              put: true, // 可接收拖回
            },
            sort: false,
            onMove: (sortableMoveEvent) => {
              return !sortableMoveEvent.related.closest(
                "#speakerEditorCharacterList"
              );
            },
            onStart: () => {
              document.addEventListener("dragover", editor.handleDragScrolling);
            },
            onEnd: () => {
              document.removeEventListener(
                "dragover",
                editor.handleDragScrolling
              );
              editor.stopScrolling();
            },
          onAdd: (sortableAddEvent) => {
            const cardItem = sortableAddEvent.item;
            const actionId = cardItem.dataset.id;

            if (actionId) {
              // 判断被拖入卡片的类型
              if (cardItem.classList.contains("dialogue-item")) {
                editor.removeAllSpeakersFromAction(actionId);
              } else if (cardItem.classList.contains("layout-item")) {
                const layoutAction = editor.projectFileState.actions.find(
                  (actionItem) => actionItem.id === actionId
                );
                const deleteIndex = editor.projectFileState.actions.findIndex(
                  (actionItem) => actionItem.id === actionId
                );
                if (deleteIndex > -1) {
                  editor.pendingCardMutationRender = {
                    type: "delete",
                    actionId,
                    startIndex: deleteIndex,
                    source: "ui",
                    detail: `type=layout, character=${
                      layoutAction?.characterName || layoutAction?.characterId || "?"
                    }, layoutType=${layoutAction?.layoutType || "unknown"}`,
                  };
                }
                editor.deleteLayoutAction(actionId);
              }
            }

            cardItem.remove();
          },
        })
      );
      }
      // 复用通用重排逻辑：speaker 只保留分组模式下的局部刷新标记。
      const runReorder = DragHelper.createReorderHandler({
        runCommand: (changeFn) => baseEditor.executeCommand(changeFn),
        beforeReorder: (globalOldIndex, globalNewIndex) => {
          editor.markGroupedReorderRender(
            "state",
            "drag",
            `index: ${globalOldIndex} -> ${globalNewIndex}`
          );
        },
      });

      // 使用 DragHelper 创建 onEnd 处理器（移动现有卡片）
      const onEndHandler = DragHelper.createOnEndHandler({
        editor: baseEditor,
        getGroupingEnabled: () =>
          editor.domCache.groupCheckbox?.checked || false,
        groupSize: 50,
        executeFn: runReorder,
      });

      // 当“角色”拖到画布上时：把角色设置成目标对话的说话人
      const onAddHandler = (sortableAddEvent) => {
        const characterItem = sortableAddEvent.item;
        characterItem.style.display = "none";
        const dropX = sortableAddEvent.originalEvent.clientX;
        const dropY = sortableAddEvent.originalEvent.clientY;
        const targetCard = editor._findClosestCard(dropX, dropY);

        if (!targetCard) {
          characterItem.remove();
          return;
        }
        const characterId = parseInt(characterItem.dataset.characterId);
        const characterName = characterItem.dataset.characterName;
        const actionId = targetCard.dataset.id;
        const actionIndex = Number.parseInt(targetCard.dataset.actionIndex, 10);
        if (actionId) {
          editor.updateSpeakerAssignment(
            actionId,
            {
              characterId,
              name: characterName,
            },
            actionIndex
          );
        }
        characterItem.remove();
      };

      if (!hasCanvasSortable) {
        editor.sortableInstances.push(
          new Sortable(
            canvas,
            DragHelper.createSortableConfig({
              group: "shared-speakers",
              onEnd: (sortableEvent) => {
                document.removeEventListener(
                  "dragover",
                  editor.handleDragScrolling
                );
                editor.stopScrolling();
                onEndHandler(sortableEvent);
              },
              onAdd: onAddHandler,
              extraConfig: {
                sort: true,
                onStart: () => {
                  document.addEventListener(
                    "dragover",
                    editor.handleDragScrolling
                  );
                },
              },
            })
          )
        );
      }
    },

    // 内部方法：优先按落点直接命中卡片，失败时再按 Y 坐标找最近卡片
    _findClosestCard(x, y) {
      const canvas = editor.domCache.canvas;
      if (!canvas) return null;

      const dropTarget = document.elementFromPoint(x, y);
      const directCard = dropTarget?.closest(".dialogue-item");
      if (directCard && canvas.contains(directCard)) {
        return directCard;
      }

      const cards = Array.from(canvas.querySelectorAll(".dialogue-item"));

      let closestCard = null;
      let minDistance = Infinity;

      for (const dialogueCard of cards) {
        const rect = dialogueCard.getBoundingClientRect();
        const cardCenterY = rect.top + rect.height / 2;
        const distance = Math.abs(y - cardCenterY);

        if (distance < minDistance) {
          minDistance = distance;
          closestCard = dialogueCard;
        }
      }
      // 添加一个阈值，如果拖拽位置离任何卡片都太远，则不视为有效目标
      const closestRect = closestCard
        ? closestCard.getBoundingClientRect()
        : null;
      if (closestCard && minDistance > closestRect.height) {
        return null;
      }
      return closestCard;
    },
  });
}
