// static/js/historyManager.js (新建文件)

export const historyManager = {
  
  undoStack: [], // 存储可撤销操作的栈
  redoStack: [], // 存储可重做操作的栈
  limit: 50,     // 最多记录50步历史
  
  /**
   * 记录一个新操作。
   * @param {object} command - 一个包含 execute 和 undo 方法的对象。
   *   - command.execute(): 一个执行操作的函数。
   *   - command.undo(): 一个撤销操作的函数。
   */
  do(command) {
    // 在执行新操作前，清空重做栈
    this.redoStack = [];
    
    // 执行操作
    command.execute();
    
    // 将操作推入撤销栈
    this.undoStack.push(command);

    // 如果超出限制，移除最旧的操作
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    this.triggerUpdate();
  },

  /**
   * 撤销上一步操作。
   */
  undo() {
    if (!this.canUndo()) return;

    const command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);
    this.triggerUpdate();
  },

  /**
   * 重做上一步被撤销的操作。
   */
  redo() {
    if (!this.canRedo()) return;

    const command = this.redoStack.pop();
    command.execute();
    this.undoStack.push(command);
    this.triggerUpdate();
  },

  /**
   * 检查是否可以执行撤销。
   * @returns {boolean}
   */
  canUndo() {
    return this.undoStack.length > 0;
  },

  /**
   * 检查是否可以执行重做。
   * @returns {boolean}
   */
  canRedo() {
    return this.redoStack.length > 0;
  },

  /**
   * 清空所有历史记录。
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.triggerUpdate();
  },
  
  /**
   * 触发一个自定义事件，通知UI更新撤销/重做按钮的状态。
   */
  triggerUpdate() {
      document.dispatchEvent(new CustomEvent('historychange', {
          detail: {
              canUndo: this.canUndo(),
              canRedo: this.canRedo()
          }
      }));
  }
};