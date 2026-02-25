// 拖拽助手：处理拖拽事件中的坐标提取、落点验证、DOM 重排等通用逻辑。

export const DragHelper = {
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

  // 无效落点后，按当前状态重渲染还原 DOM 顺序。
  handleInvalidDrop(editor) {
    editor.handleRenderCallback?.();
  },

  // 把 actions[fromIndex] 挪到 toIndex。
  moveAction(actions, fromIndex, toIndex, source = "DragHelper") {
    if (!Array.isArray(actions)) {
      console.error(`[${source}] actions 不是数组，无法重排`);
      return;
    }
    if (fromIndex < 0 || fromIndex >= actions.length) {
      console.error(
        `[${source}] 无效索引 fromIndex=${fromIndex}, actions.length=${actions.length}`
      );
      return;
    }

    const [movedItem] = actions.splice(fromIndex, 1);
    if (!movedItem) {
      console.error(`[${source}] 重排失败，未找到 fromIndex=${fromIndex} 的元素`);
      return;
    }
    actions.splice(toIndex, 0, movedItem);
  },

  // 生成“按全局索引重排 action”的执行函数，供多个编辑器复用。
  createReorderHandler(params = {}) {
    const { runCommand, beforeReorder, source = "DragHelper" } = params;
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
          globalNewIndex,
          source
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
    } = params;
    if (
      !container ||
      !isGroupingEnabled ||
      totalActions <= groupSize ||
      activeGroupIndex === null ||
      activeGroupIndex < 0
    ) {
      return false;
    }

    const cards = container.querySelectorAll(cardSelector);
    if (!cards.length) {
      return false;
    }

    const groupStartIndex = activeGroupIndex * groupSize;
    cards.forEach((cardElement, localIndex) => {
      const globalIndex = groupStartIndex + localIndex;
      cardElement.dataset.actionIndex = String(globalIndex);
      const numberDiv = cardElement.querySelector(".card-sequence-number");
      if (numberDiv) {
        numberDiv.textContent = `#${globalIndex + 1}`;
      }
    });
    return true;
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
