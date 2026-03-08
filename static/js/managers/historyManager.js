// 撤销和重做记录
export const historyManager = {
  undoStack: [],
  redoStack: [],
  limit: 50,

  // 记录并执行一次操作
  do(command) {
    this.redoStack = [];
    command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    this.triggerUpdate();
  },

  // 撤销上一步
  undo() {
    if (!this.undoStack.length) return;

    const command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);
    this.triggerUpdate();
  },

  // 重做上一步
  redo() {
    if (!this.redoStack.length) return;

    const command = this.redoStack.pop();
    command.execute();
    this.undoStack.push(command);
    this.triggerUpdate();
  },

  // 清空历史记录
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.triggerUpdate();
  },

  // 通知页面更新按钮状态
  triggerUpdate() {
    document.dispatchEvent(
      new CustomEvent("historychange", {
        detail: {
          canUndo: this.undoStack.length > 0,
          canRedo: this.redoStack.length > 0,
        },
      })
    );
  },
};
