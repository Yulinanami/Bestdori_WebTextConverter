// 处理说话人编辑器拖拽
import { DragHelper } from "@editors/common/DragHelper.js";

// 添加拖拽能力
export function attachSpeakerDrag(editor) {
  Object.assign(editor, {
    // 开关拖拽
    toggleSpeakerDrag(enabled) {
      const disabled = !enabled;
      this.sortableInstances.forEach((instance) => {
        instance?.option?.("disabled", disabled);
      });
    },

    // 拖动时自动滚动
    handleDragScrolling: DragHelper.createAutoScrollHandler(editor, [
      editor.domCache.canvas,
      editor.domCache.characterList,
    ]),

    // 初始化拖拽
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

      // 角色列表支持拖出
      if (!hasCharacterSortable) {
        editor.sortableInstances.push(
          new Sortable(characterList, {
            group: {
              name: "shared-speakers",
              pull: "clone", // 拖出时克隆
              put: true, // 可接收拖回
            },
            sort: false,
            // 拦掉不该拖回角色列表的卡片
            onMove: (sortableMoveEvent) => {
              if (sortableMoveEvent.dragged.classList.contains("layout-item")) {
                return false;
              }
              return !sortableMoveEvent.related.closest(
                "#speakerEditorCharacterList"
              );
            },
            // 开始拖拽时开启自动滚动监听
            onStart: () => DragHelper.startDocumentAutoScroll(editor),
            // 结束拖拽时关闭自动滚动监听
            onEnd: () => DragHelper.stopDocumentAutoScroll(editor),
            // 把拖回角色列表的对话卡片改成清空说话人
            onAdd: (sortableAddEvent) => {
              const cardItem = sortableAddEvent.item;
              const actionId = cardItem.dataset.id;

              // 拖回右侧就清空说话人
              if (actionId && cardItem.classList.contains("dialogue-item")) {
                editor.clearActionSpeakers(actionId);
              }

              cardItem.remove();
              // 有些操作不会触发 patch 所以补一次渲染
              editor.scheduleRender();
            },
          })
        );
      }
      // 画布重排统一走 DragHelper 里的默认结束处理
      const onEndHandler = DragHelper.createEditorOnEndHandler(editor, 50);

      // 角色拖到卡片上时改说话人
      // 把拖进画布的角色卡片转成说话人变更
      const onAddHandler = (sortableAddEvent) => {
        const characterItem = sortableAddEvent.item;
        characterItem.style.display = "none";
        const pointerEvent = sortableAddEvent.originalEvent;
        const pointer =
          pointerEvent?.changedTouches?.[0] ||
          pointerEvent?.touches?.[0] ||
          pointerEvent;
        const dropX = pointer?.clientX;
        const dropY = pointer?.clientY;

        let targetCard = editor._findClosestCard(dropX, dropY);
        if (!targetCard) {
          const nextCard = characterItem.nextElementSibling?.closest(
            ".dialogue-item"
          );
          const prevCard = characterItem.previousElementSibling?.closest(
            ".dialogue-item"
          );
          targetCard = nextCard || prevCard || null;
        }

        if (!targetCard) {
          characterItem.remove();
          return;
        }
        const characterId = parseInt(characterItem.dataset.characterId, 10);
        const characterName = characterItem.dataset.characterName;
        const actionId = targetCard.dataset.id;
        const actionIndex = Number.parseInt(targetCard.dataset.actionIndex, 10);
        if (actionId && Number.isInteger(characterId)) {
          editor.assignSpeaker(
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
              // 结束拖拽时先判断是否真的落进画布
              onEnd: (sortableEvent) => {
                DragHelper.stopDocumentAutoScroll(editor);
                // 没落在画布里就回滚
                if (!DragHelper.isDropInsideContainer(sortableEvent, canvas)) {
                  editor.applyGroupReorder("state");
                  editor.reattachSelection();
                  return;
                }
                onEndHandler(sortableEvent);
              },
              onAdd: onAddHandler,
              extraConfig: {
                sort: true,
                // 开始拖拽时开启自动滚动监听
                onStart: () => DragHelper.startDocumentAutoScroll(editor),
              },
            })
          )
        );
      }
      this.toggleSpeakerDrag(true);
    },

    // 找离落点最近的卡片
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
      // 离得太远就不算命中
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
