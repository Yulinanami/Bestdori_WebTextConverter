/**
 * 拖拽助手工具 - 为编辑器提供拖拽相关的辅助功能
 *
 * 用于处理 Sortable.js 的配置和事件
 */

export const DragHelper = {
  /**
   * 创建标准的 Sortable 配置对象
   * @param {Object} options - 配置选项
   * @param {string} options.group - Sortable 分组名称
   * @param {Function} options.onEnd - 拖拽结束回调（移动现有项）
   * @param {Function} options.onAdd - 添加新项回调
   * @param {Object} options.extraConfig - 额外的 Sortable 配置
   * @returns {Object} Sortable 配置对象
   */
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

  /**
   * 创建拖拽结束处理器（移动现有项）
   * @param {Object} params - 参数对象
   * @param {Object} params.editor - 编辑器实例（必须有 BaseEditor 的方法）
   * @param {Function} params.getGroupingEnabled - 获取是否启用分组的函数
   * @param {number} params.groupSize - 每组大小
   * @param {Function} params.executeFn - 执行移动的函数 (oldIndex, newIndex) => void
   * @returns {Function} onEnd 事件处理器
   */
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

  /**
   * 创建添加新项处理器
   * @param {Object} params - 参数对象
   * @param {Object} params.editor - 编辑器实例（必须有 BaseEditor 的方法）
   * @param {Function} params.getGroupingEnabled - 获取是否启用分组的函数
   * @param {Function} params.validateItem - 验证拖拽项的函数 (item) => boolean
   * @param {Function} params.extractData - 从拖拽项提取数据的函数 (item) => Object
   * @param {Function} params.executeFn - 执行添加的函数 (data, globalIndex) => void
   * @returns {Function} onAdd 事件处理器
   */
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
      let localInsertIndex = evt.newDraggableIndex;

      if (
        isGroupingEnabled &&
        editor.projectFileState?.actions?.length > groupSize &&
        editor.activeGroupIndex !== null &&
        editor.activeGroupIndex >= 0
      ) {
        // 减去前面所有分组标题（包括当前分组）占据的位置
        const headerOffset = editor.getHeaderOffset(true);
        localInsertIndex = Math.max(0, localInsertIndex - headerOffset);
      }

      const globalInsertIndex = editor.getGlobalIndex(
        localInsertIndex,
        isGroupingEnabled
      );

      // 提取数据
      const data = extractData(item);

      // 执行添加
      if (data) {
        executeFn(data, globalInsertIndex);
      }

      // 移除拖拽项
      item.remove();
    };
  },
};
