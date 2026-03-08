// 拖拽相关的通用方法

export const DragHelper = {
  // 拖拽时自动滚动容器
  handleAutoScroll(editor, dragEvent, scrollContainers = []) {
    if (!scrollContainers.length) {
      return;
    }

    let scrollTarget = null;
    for (const scrollContainer of scrollContainers) {
      if (scrollContainer && scrollContainer.contains(dragEvent.target)) {
        scrollTarget = scrollContainer;
        break;
      }
    }

    if (!scrollTarget) {
      DragHelper.stopAutoScroll(editor);
      return;
    }

    const rect = scrollTarget.getBoundingClientRect();
    const mouseY = dragEvent.clientY;
    const hotZone = 75;
    let nextScrollSpeed = 0;

    if (mouseY < rect.top + hotZone) {
      nextScrollSpeed = -10;
    } else if (mouseY > rect.bottom - hotZone) {
      nextScrollSpeed = 10;
    }

    if (nextScrollSpeed === 0) {
      DragHelper.stopAutoScroll(editor);
      return;
    }

    if (
      nextScrollSpeed !== editor.scrollSpeed ||
      !editor.scrollAnimationFrame
    ) {
      editor.scrollSpeed = nextScrollSpeed;
      DragHelper.startAutoScroll(editor, scrollTarget);
    }
  },

  // 开始自动滚动
  startAutoScroll(editor, elementToScroll) {
    DragHelper.stopAutoScroll(editor);

    // 每一帧继续滚动
    const scroll = () => {
      if (elementToScroll && editor.scrollSpeed !== 0) {
        elementToScroll.scrollTop += editor.scrollSpeed;
        editor.scrollAnimationFrame = requestAnimationFrame(scroll);
      }
    };

    scroll();
  },

  // 停止自动滚动
  stopAutoScroll(editor) {
    if (editor.scrollAnimationFrame) {
      cancelAnimationFrame(editor.scrollAnimationFrame);
      editor.scrollAnimationFrame = null;
    }
    editor.scrollSpeed = 0;
  },

  // 按当前顺序刷新卡片序号
  syncCardOrderMeta(params = {}) {
    const { container, cardSelector, startIndex = 0, baseIndex = 0 } = params;
    if (!container) {
      return false;
    }
    const cards = container.querySelectorAll(cardSelector);
    if (!cards.length) {
      return false;
    }

    const from = Math.max(0, Number(startIndex) || 0);
    const base = Number(baseIndex) || 0;
    for (let localIndex = from; localIndex < cards.length; localIndex++) {
      const globalIndex = base + localIndex;
      const cardElement = cards[localIndex];
      cardElement.dataset.actionIndex = String(globalIndex);
      const numberDiv = cardElement.querySelector(".card-sequence-number");
      if (numberDiv) {
        numberDiv.textContent = `#${globalIndex + 1}`;
      }
    }
    return true;
  },

  // 从拖拽事件里拿到指针位置
  extractPointerFromSortableEvent(sortableEvent) {
    const pointerEvent = sortableEvent?.originalEvent;
    const point =
      pointerEvent?.changedTouches?.[0] ||
      pointerEvent?.touches?.[0] ||
      pointerEvent;
    const x = point?.clientX;
    const y = point?.clientY;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    return { x, y };
  },

  // 看拖拽最后有没有落在容器里
  isDropInsideContainer(sortableEvent, container) {
    if (!container) {
      return false;
    }
    const pointer = DragHelper.extractPointerFromSortableEvent(sortableEvent);
    if (!pointer) {
      return false;
    }
    const dropTarget = document.elementFromPoint(pointer.x, pointer.y);
    if (!dropTarget) {
      return false;
    }
    return container.contains(dropTarget);
  },

  // 把一项挪到新位置
  moveAction(actions, fromIndex, toIndex) {
    const [movedItem] = actions.splice(fromIndex, 1);
    actions.splice(toIndex, 0, movedItem);
  },

  // 生成重排方法
  createReorderHandler(params = {}) {
    const { runCommand, beforeReorder } = params;
    return (globalOldIndex, globalNewIndex) => {
      if (globalOldIndex === globalNewIndex) {
        return;
      }
      if (beforeReorder) {
        beforeReorder(globalOldIndex, globalNewIndex);
      }
      runCommand((currentState) => {
        DragHelper.moveAction(
          currentState.actions,
          globalOldIndex,
          globalNewIndex
        );
      });
    };
  },

  // 分组拖拽后刷新当前组序号
  applyGroupedReorderRender(params = {}) {
    const {
      container,
      cardSelector,
      groupSize = 50,
      totalActions = 0,
      isGroupingEnabled = false,
      activeGroupIndex = null,
      reorderByState = false,
      activeGroupActionIds = [],
    } = params;
    if (!container) {
      return false;
    }

    if (reorderByState) {
      const expectedIds = activeGroupActionIds;
      if (!expectedIds.length) {
        return false;
      }

      const shouldGroup =
        isGroupingEnabled &&
        totalActions > groupSize &&
        activeGroupIndex !== null &&
        activeGroupIndex >= 0;

      const allCards = Array.from(container.querySelectorAll(cardSelector));
      if (!allCards.length) {
        return false;
      }

      const cardById = new Map(
        allCards.map((cardElement) => [cardElement.dataset.id, cardElement])
      );

      // 先确认要动的卡片都在
      for (const actionId of expectedIds) {
        if (!cardById.has(actionId)) {
          return false;
        }
      }

      if (shouldGroup) {
        const activeHeader = container.querySelector(
          `.timeline-group-header[data-group-idx="${activeGroupIndex}"]`
        );
        if (!activeHeader) {
          return false;
        }

        // 检查完后再改 DOM
        const fragment = document.createDocumentFragment();
        for (const actionId of expectedIds) {
          fragment.appendChild(cardById.get(actionId));
        }

        const removableCards = [];
        let nextNode = activeHeader.nextElementSibling;
        while (
          nextNode &&
          !nextNode.classList.contains("timeline-group-header")
        ) {
          if (nextNode.matches(cardSelector)) {
            removableCards.push(nextNode);
          }
          nextNode = nextNode.nextElementSibling;
        }

        removableCards.forEach((cardElement) => cardElement.remove());
        container.insertBefore(fragment, nextNode);
      } else {
        // 检查完后再改 DOM
        const fragment = document.createDocumentFragment();
        for (const actionId of expectedIds) {
          fragment.appendChild(cardById.get(actionId));
        }
        // 直接把 fragment 放回去
        container.appendChild(fragment);
      }

      const baseIndex = shouldGroup ? activeGroupIndex * groupSize : 0;
      return DragHelper.syncCardOrderMeta({
        container,
        cardSelector,
        startIndex: 0,
        baseIndex,
      });
    }

    if (
      !isGroupingEnabled ||
      totalActions <= groupSize ||
      activeGroupIndex === null ||
      activeGroupIndex < 0
    ) {
      return false;
    }

    const groupStartIndex = activeGroupIndex * groupSize;
    return DragHelper.syncCardOrderMeta({
      container,
      cardSelector,
      startIndex: 0,
      baseIndex: groupStartIndex,
    });
  },

  // 生成通用拖拽配置
  createSortableConfig(options = {}) {
    const config = {
      animation: 150,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      dragClass: "sortable-drag",
    };

    if (options.group) {
      config.group = options.group;
    }

    if (options.onEnd) {
      config.onEnd = options.onEnd;
    }

    if (options.onAdd) {
      config.onAdd = options.onAdd;
    }

    // 合并额外配置
    if (options.extraConfig) {
      Object.assign(config, options.extraConfig);
    }

    return config;
  },

  // 生成拖拽结束处理
  createOnEndHandler(params) {
    const { editor, groupSize = 50, executeFn } = params;

    return (sortableEvent) => {
      if (sortableEvent.from === sortableEvent.to) {
        const isGroupingEnabled = editor.domCache?.groupCheckbox?.checked || false;
        let localOldIndex = sortableEvent.oldIndex;
        let localNewIndex = sortableEvent.newIndex;

        if (
          isGroupingEnabled &&
          editor.projectFileState?.actions?.length > groupSize &&
          editor.activeGroupIndex !== null &&
          editor.activeGroupIndex >= 0
        ) {
          // 减掉前面分组标题占的位置
          const headerOffset = editor.resolveHeaderOffset(true);
          localOldIndex = Math.max(0, localOldIndex - headerOffset);
          localNewIndex = Math.max(0, localNewIndex - headerOffset);
        }

        const globalOldIndex = editor.resolveGlobalIndex(
          localOldIndex,
          isGroupingEnabled
        );
        const globalNewIndex = editor.resolveGlobalIndex(
          localNewIndex,
          isGroupingEnabled
        );

        executeFn(globalOldIndex, globalNewIndex);
      }
    };
  },

  // 生成拖入处理
  createOnAddHandler(params) {
    const {
      editor,
      validateItem,
      extractData,
      executeFn,
      groupSize = 50,
    } = params;

    return (sortableEvent) => {
      const draggedItem = sortableEvent.item;

      // 先检查拖进来的内容
      if (!validateItem(draggedItem)) {
        draggedItem.remove();
        return;
      }

      const isGroupingEnabled = editor.domCache?.groupCheckbox?.checked || false;
      let localInsertIndex =
        sortableEvent.newDraggableIndex !== undefined &&
        sortableEvent.newDraggableIndex !== null
          ? sortableEvent.newDraggableIndex
          : sortableEvent.newIndex;

      if (
        localInsertIndex === undefined ||
        localInsertIndex === null ||
        Number.isNaN(localInsertIndex)
      ) {
        localInsertIndex = editor.projectFileState?.actions?.length || 0;
      }

      if (
        isGroupingEnabled &&
        editor.projectFileState?.actions?.length > groupSize &&
        editor.activeGroupIndex !== null &&
        editor.activeGroupIndex >= 0
      ) {
        // 减掉前面分组标题占的位置
        const headerOffset = editor.resolveHeaderOffset(true);
        localInsertIndex = Math.max(0, Number(localInsertIndex) - headerOffset);
      }

      const globalInsertIndex = editor.resolveGlobalIndex(
        Number(localInsertIndex),
        isGroupingEnabled
      );

      // 取出拖进来的数据
      const data = extractData(draggedItem);

      // 把数据加进去
      if (data) {
        executeFn(data, globalInsertIndex);
      }

      // 不是原列表节点时再删掉拖拽占位
      if (
        draggedItem &&
        draggedItem.parentNode &&
        draggedItem.parentNode !== sortableEvent.from
      ) {
        draggedItem.remove();
      }
    };
  },
};
