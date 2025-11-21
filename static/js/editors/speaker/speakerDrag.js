import { DragHelper } from "../../utils/DragHelper.js";
import { ScrollAnimationMixin } from "../../mixins/ScrollAnimationMixin.js";

// 与拖拽相关的逻辑
export function attachSpeakerDrag(editor, baseEditor) {
  Object.assign(editor, {
    handleDragScrolling: (e) => {
      const containers = [
        editor.domCache.canvas,
        editor.domCache.characterList,
      ];
      ScrollAnimationMixin.handleDragScrolling.call(editor, e, containers);
    },

    // 根据 Y 坐标查找最接近的对话卡片（用于拖拽插入位置计算）
    _findClosestCard(y) {
      const canvas = editor.domCache.canvas;
      if (!canvas) return null;
      const cards = Array.from(canvas.querySelectorAll(".dialogue-item"));

      let closestCard = null;
      let minDistance = Infinity;

      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        const cardCenterY = rect.top + rect.height / 2;
        const distance = Math.abs(y - cardCenterY);

        if (distance < minDistance) {
          minDistance = distance;
          closestCard = card;
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

    /**
     * 初始化拖拽功能
     * 设置两个Sortable实例:
     * 1. 角色列表 - 可拖出(clone模式),拖回时清除说话人
     * 2. 对话画布 - 可排序,可接收角色拖入并分配说话人
     */
    initDragAndDrop() {
      const characterList = editor.domCache.characterList;
      const canvas = editor.domCache.canvas;
      if (!characterList || !canvas) return;

      // 清理旧的 Sortable 实例
      editor.sortableInstances.forEach((instance) => instance?.destroy());
      editor.sortableInstances = [];

      // 角色列表的Sortable配置
      editor.sortableInstances.push(
        new Sortable(characterList, {
          group: {
            name: "shared-speakers",
            pull: "clone", // 拖出时克隆
            put: true, // 可接收拖回
          },
          sort: false,
          onMove: (evt) => {
            return !evt.related.closest("#speakerEditorCharacterList");
          },
          onStart: () => {
            document.addEventListener("dragover", editor.handleDragScrolling);
          },
          onEnd: () => {
            document.removeEventListener("dragover", editor.handleDragScrolling);
            editor.stopScrolling();
          },
          onAdd: (evt) => {
            const cardItem = evt.item;
            const actionId = cardItem.dataset.id;

            if (actionId) {
              // 判断被拖入卡片的类型
              if (cardItem.classList.contains("dialogue-item")) {
                editor.removeAllSpeakersFromAction(actionId);
              } else if (cardItem.classList.contains("layout-item")) {
                editor._deleteLayoutAction(actionId);
              }
            }

            cardItem.remove();
          },
        })
      );
      // 使用 DragHelper 创建 onEnd 处理器（移动现有卡片）
      const onEndHandler = DragHelper.createOnEndHandler({
        editor: baseEditor,
        getGroupingEnabled: () =>
          editor.domCache.groupCheckbox?.checked || false,
        groupSize: 50,
        executeFn: (globalOldIndex, globalNewIndex) => {
          baseEditor.executeCommand((currentState) => {
            // 验证索引有效性
            if (
              globalOldIndex < 0 ||
              globalOldIndex >= currentState.actions.length
            ) {
              console.error(
                `Invalid globalOldIndex: ${globalOldIndex}, actions length: ${currentState.actions.length}`
              );
              return;
            }

            const [movedItem] = currentState.actions.splice(globalOldIndex, 1);

            // 验证 movedItem 存在
            if (!movedItem) {
              console.error(
                `movedItem is undefined at index ${globalOldIndex}`
              );
              return;
            }

            currentState.actions.splice(globalNewIndex, 0, movedItem);
          });
        },
      });

      // 创建自定义的 onAdd 处理器（speakerEditor 有特殊逻辑）
      const onAddHandler = (evt) => {
        const characterItem = evt.item;
        characterItem.style.display = "none";
        const dropY = evt.originalEvent.clientY;
        const targetCard = editor._findClosestCard(dropY);

        if (!targetCard) {
          characterItem.remove();
          return;
        }
        const characterId = parseInt(characterItem.dataset.characterId);
        const characterName = characterItem.dataset.characterName;
        const actionId = targetCard.dataset.id;
        if (characterId && actionId) {
          editor.updateSpeakerAssignment(actionId, {
            characterId,
            name: characterName,
          });
        }
        characterItem.remove();
      };

      editor.sortableInstances.push(
        new Sortable(
          canvas,
          DragHelper.createSortableConfig({
            group: "shared-speakers",
            onEnd: (evt) => {
              document.removeEventListener(
                "dragover",
                editor.handleDragScrolling
              );
              editor.stopScrolling();
              onEndHandler(evt);
            },
            onAdd: onAddHandler,
            extraConfig: {
              sort: true,
              onStart: () => {
                document.addEventListener("dragover", editor.handleDragScrolling);
              },
            },
          })
        )
      );
    },
  });
}
