// 拖拽助手：处理拖拽事件中的坐标提取、落点验证、DOM 重排等通用逻辑。

export const DragHelper = {
  // 按当前 DOM 顺序批量刷新卡片的 actionIndex 与显示序号。
  syncCardOrderMeta(params = {}) {
    const {
      container,
      cardSelector,
      startIndex = 0,
      baseIndex = 0,
    } = params;
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

  // 从 Sortable 事件里提取当前指针坐标（鼠标/触摸）。
  getPointerFromSortableEvent(sortableEvent) {
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

  // 判断拖拽结束落点是否仍在指定容器内。
  isDropInsideContainer(sortableEvent, container) {
    if (!container) {
      return false;
    }
    const pointer = DragHelper.getPointerFromSortableEvent(sortableEvent);
    if (!pointer) {
      return false;
    }
    const dropTarget = document.elementFromPoint(pointer.x, pointer.y);
    if (!dropTarget) {
      return false;
    }
    return container.contains(dropTarget);
  },

  // 把 actions[fromIndex] 挪到 toIndex。
  moveAction(actions, fromIndex, toIndex) {
    const [movedItem] = actions.splice(fromIndex, 1);
    actions.splice(toIndex, 0, movedItem);
  },

  // 生成“按全局索引重排 action”的执行函数，供多个编辑器复用。
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

  // 分组拖拽排序后，仅刷新当前展开分组里的卡片序号和 actionIndex。
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
      const fragment = document.createDocumentFragment();
      for (const actionId of expectedIds) {
        const cardElement = cardById.get(actionId);
        if (!cardElement) {
          return false;
        }
        fragment.appendChild(cardElement);
      }

      if (shouldGroup) {
        const activeHeader = container.querySelector(
          `.timeline-group-header[data-group-idx="${activeGroupIndex}"]`
        );
        if (!activeHeader) {
          return false;
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
        allCards.forEach((cardElement) => cardElement.remove());
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

  // 生成一个通用的 Sortable 配置（可传 group/onEnd/onAdd/extraConfig）
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

  // 生成 onEnd 处理器：把拖拽的“本地索引”换算成“全局索引”，再调用 executeFn
  createOnEndHandler(params) {
    const {
      editor,
      getGroupingEnabled,
      groupSize = 50,
      executeFn,
    } = params;

    return (sortableEvent) => {
      if (sortableEvent.from === sortableEvent.to) {
        const isGroupingEnabled = getGroupingEnabled();
        let localOldIndex = sortableEvent.oldIndex;
        let localNewIndex = sortableEvent.newIndex;

        if (
          isGroupingEnabled &&
          editor.projectFileState?.actions?.length > groupSize &&
          editor.activeGroupIndex !== null &&
          editor.activeGroupIndex >= 0
        ) {
          // 减去前面所有分组标题（包括当前分组）占据的位置
          const headerOffset = editor.getHeaderOffset(true);
          localOldIndex = Math.max(0, localOldIndex - headerOffset);
          localNewIndex = Math.max(0, localNewIndex - headerOffset);
        }

        const globalOldIndex = editor.getGlobalIndex(
          localOldIndex,
          isGroupingEnabled
        );
        const globalNewIndex = editor.getGlobalIndex(
          localNewIndex,
          isGroupingEnabled
        );

        executeFn(globalOldIndex, globalNewIndex);
      }
    };
  },

  // 生成 onAdd 处理器：校验拖入项 -> 提取数据 -> 计算插入位置 -> 调用 executeFn
  createOnAddHandler(params) {
    const {
      editor,
      getGroupingEnabled,
      validateItem,
      extractData,
      executeFn,
      groupSize = 50,
    } = params;

    return (sortableEvent) => {
      const draggedItem = sortableEvent.item;

      // 验证拖拽项
      if (!validateItem(draggedItem)) {
        draggedItem.remove();
        return;
      }

      const isGroupingEnabled = getGroupingEnabled();
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
        // 减去前面所有分组标题（包括当前分组）占据的位置
        const headerOffset = editor.getHeaderOffset(true);
        localInsertIndex = Math.max(0, Number(localInsertIndex) - headerOffset);
      }

      const globalInsertIndex = editor.getGlobalIndex(
        Number(localInsertIndex),
        isGroupingEnabled
      );

      // 提取数据
      const data = extractData(draggedItem);

      // 执行添加
      if (data) {
        executeFn(data, globalInsertIndex);
      }

      // 移除拖拽项（仅当它不属于源列表时，避免误删原始节点）
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
