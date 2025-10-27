// 布局属性管理 Mixin
// 提供布局卡片的属性更新功能（位置、偏移、服装、类型等）

export const LayoutPropertyMixin = {
  /**
   * 布局属性更新策略处理器映射
   * 每个处理器负责更新特定控件类型对应的 action 属性
   */
  _layoutPropertyHandlers: {
    "layout-type-select": (action, value) => {
      action.layoutType = value;
    },

    "layout-costume-select": (action, value) => {
      action.costume = value;
    },

    "layout-position-select-to": (action, value) => {
      if (!action.position) action.position = {};
      if (!action.position.to) action.position.to = {};
      action.position.to.side = value;
    },

    "layout-offset-input-to": (action, value) => {
      if (!action.position) action.position = {};
      if (!action.position.to) action.position.to = {};
      action.position.to.offsetX = value;
    },

    "layout-position-select": (action, value) => {
      if (!action.position) action.position = {};
      if (!action.position.from) action.position.from = {};
      action.position.from.side = value;

      // 非移动类型时同时设置 to
      if (action.layoutType !== "move") {
        if (!action.position.to) action.position.to = {};
        action.position.to.side = value;
      }
    },

    "layout-offset-input": (action, value) => {
      if (!action.position) action.position = {};
      if (!action.position.from) action.position.from = {};
      action.position.from.offsetX = value;

      // 非移动类型时同时设置 to
      if (action.layoutType !== "move") {
        if (!action.position.to) action.position.to = {};
        action.position.to.offsetX = value;
      }
    },
  },

  /**
   * 更新布局动作的属性（类型、位置、偏移、服装）
   * @param {string} actionId - 动作ID
   * @param {HTMLElement} targetElement - 触发变化的DOM元素
   */
  _updateLayoutActionProperty(actionId, targetElement) {
    const value =
      targetElement.type === "number"
        ? parseInt(targetElement.value) || 0
        : targetElement.value;
    const controlClassName = targetElement.className;

    this._executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (!action) return;

      // 查找匹配的处理器并执行
      const handlerKey = Object.keys(this._layoutPropertyHandlers).find((key) =>
        controlClassName.includes(key)
      );

      if (handlerKey) {
        this._layoutPropertyHandlers[handlerKey](action, value);
      }
    });
  },
};
