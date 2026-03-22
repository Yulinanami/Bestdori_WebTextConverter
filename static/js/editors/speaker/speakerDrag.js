// 处理说话人编辑器拖拽
import { DragHelper } from "@editors/common/DragHelper.js";

// 添加拖拽能力
export function attachSpeakerDrag(editor) {
  Object.assign(editor, {
    // 根据当前是否是排序模式刷新卡片的拖拉状态
    applySortModeToCards() {
      const isSortMode = this.isSortMode;
      const canvasSortable = this.sortableInstances.find(
        (instance) => instance?.el === this.domCache.canvas
      );
      if (canvasSortable) {
        // 当开启排序模式时，启用 Sortable 的排序能力，屏蔽点击头像等触发
        canvasSortable.option("disabled", !isSortMode);
      }
      
      const cards = this.domCache.canvas?.querySelectorAll(".dialogue-item");
      if (cards) {
        cards.forEach((card) => {
          // 非排序模式下（删除模式），允许整张卡片原生拖拽
          card.draggable = !isSortMode;
        });
      }
    },

    // 开关拖拽
    toggleSpeakerDrag(enabled) {
      const disabled = !enabled;
      this.sortableInstances.forEach((instance) => {
        instance?.option?.("disabled", disabled);
      });
    },

    // 拖动时自动滚动与候选卡片高亮
    handleDragScrolling: (dragEvent) => {
      DragHelper.handleAutoScroll(editor, dragEvent, [
        editor.domCache.canvas,
        editor.domCache.characterList,
      ]);

      if (editor._isDraggingCharacter) {
        const pointer =
          dragEvent.changedTouches?.[0] ||
          dragEvent.touches?.[0] ||
          dragEvent;
        const dropX = pointer.clientX;
        const dropY = pointer.clientY;
        const targetCard = editor._findClosestCard(dropX, dropY);

        if (editor._highlightedCard && editor._highlightedCard !== targetCard) {
          editor._highlightedCard.classList.remove("is-selected", "is-drag-target");
          // 尝试恢复原来选中状态（如果有必要，选中的触发会在松手时重置，所以目前直接去掉就好）
        }

        if (targetCard && targetCard !== editor._highlightedCard) {
          targetCard.classList.add("is-selected", "is-drag-target");
          editor._highlightedCard = targetCard;
        }
      }
    },

    // 初始化拖拽
    initDragAndDrop() {
      const characterList = editor.domCache.characterList;
      const canvas = editor.domCache.canvas;
      if (!characterList || !canvas) return;

      // 无论切换何种模式，先销毁旧实例以保证热切换无残留
      if (editor.sortableInstances) {
        editor.sortableInstances.forEach(instance => instance?.el && instance.destroy());
      }
      editor.sortableInstances = [];

      if (!editor.isDragOptimized) {
        // 角色列表支持拖出
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
              return !sortableMoveEvent.related.closest("#speakerEditorCharacterList");
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

        // 画布重排统一走 DragHelper 里的默认结束处理
        const onEndHandler = DragHelper.createEditorOnEndHandler(editor, 50);

        // 角色拖到卡片上时改说话人
        // 把拖进画布的角色卡片转成说话人变更
        const onAddHandler = (sortableAddEvent) => {
          const characterItem = sortableAddEvent.item;
          characterItem.style.display = "none";
          const pointerEvent = sortableAddEvent.originalEvent;
          const pointer =
            pointerEvent?.changedTouches?.[0] || pointerEvent?.touches?.[0] || pointerEvent;
          const dropX = pointer?.clientX;
          const dropY = pointer?.clientY;

          let targetCard = editor._findClosestCard(dropX, dropY);
          if (!targetCard) {
            const nextCard = characterItem.nextElementSibling?.closest(".dialogue-item");
            const prevCard = characterItem.previousElementSibling?.closest(".dialogue-item");
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
            editor.assignSpeaker(actionId, { characterId, name: characterName }, actionIndex);
          }
          characterItem.remove();
        };

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

        editor.toggleSpeakerDrag(true);
        // 如果是非优化模式，原生绑定需要拦截并提前返回
      } 
      else {
        editor.sortableInstances.push(
          new Sortable(characterList, {
            group: {
              name: "character-list",
              pull: "clone", // 拖出时克隆
              put: false, // 阻止其他卡片插入
            },
            sort: false,
            // 开始拖拽时开启自动滚动监听与高亮标记
            onStart: () => {
              editor._isDraggingCharacter = true;
              DragHelper.startDocumentAutoScroll(editor);
            },
            // 结束拖拽时关闭自动滚动监听与清理高亮
            onEnd: (sortableEndEvent) => {
              editor._isDraggingCharacter = false;
              if (editor._highlightedCard) {
                editor._highlightedCard.classList.remove("is-selected", "is-drag-target");
                // 强制触发一次选择变更来恢复之前的状态
                editor.domCache.canvas?.dispatchEvent(
                  new CustomEvent("selectionchange", { detail: null })
                );
                editor._highlightedCard = null;
              }
              DragHelper.stopDocumentAutoScroll(editor);
              
              if (DragHelper.isDropInsideContainer(sortableEndEvent, canvas)) {
                const characterItem = sortableEndEvent.item;
                const pointerEvent = sortableEndEvent.originalEvent;
                const pointer =
                  pointerEvent?.changedTouches?.[0] || pointerEvent?.touches?.[0] || pointerEvent;
                const dropX = pointer?.clientX;
                const dropY = pointer?.clientY;

                let targetCard = editor._findClosestCard(dropX, dropY);
                if (!targetCard) {
                  const nextCard = characterItem.nextElementSibling?.closest(".dialogue-item");
                  const prevCard = characterItem.previousElementSibling?.closest(".dialogue-item");
                  targetCard = nextCard || prevCard || null;
                }

                if (targetCard) {
                  const characterId = parseInt(characterItem.dataset.characterId, 10);
                  const characterName = characterItem.dataset.characterName;
                  const actionId = targetCard.dataset.id;
                  const actionIndex = Number.parseInt(targetCard.dataset.actionIndex, 10);
                  if (actionId && Number.isInteger(characterId)) {
                    editor.assignSpeaker(
                      actionId,
                      { characterId, name: characterName },
                      actionIndex
                    );
                  }
                }
              }
            }
          })
        );
      }

      // 添加原生拖放监听以处理从卡片上拖拽消除说话人
      if (!characterList.hasAttribute("data-drop-bound")) {
        characterList.setAttribute("data-drop-bound", "true");
        characterList.addEventListener("dragover", (e) => {
          if (!editor.isDragOptimized) return;
          if (e.dataTransfer.types.includes("application/bestdori-action-id")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }
        });
        characterList.addEventListener("drop", (e) => {
          if (!editor.isDragOptimized) return;
          const actionId = e.dataTransfer.getData("application/bestdori-action-id");
          if (actionId) {
            e.preventDefault();
            // 直接将原生拖进来的头像对应源清空
            editor.clearActionSpeakers(actionId);
          }
        });
      }

      // 左侧原生拖放整个卡片来删除角色
      if (!canvas.hasAttribute("data-drag-bound")) {
        canvas.setAttribute("data-drag-bound", "true");
        // 使用事件代理处理所有卡片的拖起
        canvas.addEventListener("dragstart", (e) => {
          if (!editor.isDragOptimized) return;
          // 如果当前开启了卡片排序模式，不执行原生拖起逻辑，直接退手交给 Sortable
          if (editor.isSortMode) return;

          const targetCard = e.target.closest(".dialogue-item");
          if (!targetCard) {
            e.preventDefault();
            return;
          }

          const actionId = targetCard.dataset.id;
          if (actionId) {
            e.dataTransfer.setData("application/bestdori-action-id", actionId);
            e.dataTransfer.effectAllowed = "move";

            // 提取出小头像作为拖拽产生的残影图像，让用户感觉“只拖出了头像”
            const avatarContainer = targetCard.querySelector(".speaker-avatar-container");
            if (avatarContainer && !avatarContainer.classList.contains("hidden")) {
               e.dataTransfer.setDragImage(avatarContainer, 15, 15);
            }

            // 给拖拽删除角色的候选对话卡片添加蓝色背景
            targetCard.classList.add("is-selected");
          }
        });

        // 监听原生拖拽结束，移除高亮背景并恢复选中状态
        canvas.addEventListener("dragend", (e) => {
          if (!editor.isDragOptimized) return;
          if (editor.isSortMode) return;
          const targetCard = e.target.closest(".dialogue-item");
          if (targetCard) {
            targetCard.classList.remove("is-selected");
            // 恢复真实选中状态展现
            editor.domCache.canvas?.dispatchEvent(
              new CustomEvent("selectionchange", { detail: null })
            );
          }
        });
      }

      // 画布重排统一走 DragHelper 里的默认结束处理
      const onEndHandler = DragHelper.createEditorOnEndHandler(editor, 50);

      if (!editor.isDragOptimized) {
        // 非优化模式没有 canvas Sortable 额外实例需要在这里推入，因为都在分支顶端处理了
      } else {
        editor.sortableInstances.push(
          new Sortable(
            canvas,
            DragHelper.createSortableConfig({
              group: {
                name: "shared-speakers",
                pull: false, // 严禁卡片跨界移动，永不离开画布边界，彻底杜绝所有空缺塌陷和重排！
                put: false,  // characterList onEnd 自行测距判断落地，这里不接手
              },
              // 结束拖拽时先判断是否真的落进画布
              onEnd: (sortableEvent) => {
                DragHelper.stopDocumentAutoScroll(editor);

                // 没落在任何有效区域内就回滚
                if (!DragHelper.isDropInsideContainer(sortableEvent, canvas)) {
                  editor.applyGroupReorder("state");
                  editor.reattachSelection();
                  return;
                }
                onEndHandler(sortableEvent);
              },
              extraConfig: {
                sort: true,
                // 开始拖拽时开启自动滚动监听
                onStart: () => DragHelper.startDocumentAutoScroll(editor),
              }
            })
          )
        );
      }
      this.toggleSpeakerDrag(true);
      // 初始化后再依据模式套用一次禁用状态
      this.applySortModeToCards();
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
