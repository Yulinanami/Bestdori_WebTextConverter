// 拖拽助手：帮你少写 Sortable.js 配置，处理分组模式下的索引换算。

export const DragHelper = {
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
    const { editor, getGroupingEnabled, groupSize = 50, executeFn } = params;

    return (evt) => {
      if (evt.from === evt.to) {
        const isGroupingEnabled = getGroupingEnabled();
        let localOldIndex = evt.oldIndex;
        let localNewIndex = evt.newIndex;

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

    return (evt) => {
      const item = evt.item;

      // 验证拖拽项
      if (!validateItem(item)) {
        item.remove();
        return;
      }

      const isGroupingEnabled = getGroupingEnabled();
      let localInsertIndex =
        evt.newDraggableIndex !== undefined && evt.newDraggableIndex !== null
          ? evt.newDraggableIndex
          : evt.newIndex;

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
      const data = extractData(item);

      // 执行添加
      if (data) {
        executeFn(data, globalInsertIndex);
      }

      // 移除拖拽项（仅当它不属于源列表时，避免误删原始节点）
      if (item && item.parentNode && item.parentNode !== evt.from) {
        item.remove();
      }
    };
  },
};
