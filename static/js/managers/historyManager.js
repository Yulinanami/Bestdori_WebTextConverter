export const historyManager = {
  undoStack: [],
  redoStack: [],
  limit: 50,

  // 执行一个“可撤销操作”，并把它记录进历史栈
  do(command) {
    this.redoStack = [];
    command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    this.triggerUpdate();
  },

  // 撤销上一步操作
  undo() {
    if (!this.canUndo()) return;

    const command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);
    this.triggerUpdate();
  },

  // 恢复上一步被撤销的操作
  redo() {
    if (!this.canRedo()) return;

    const command = this.redoStack.pop();
    command.execute();
    this.undoStack.push(command);
    this.triggerUpdate();
  },

  // 是否还有东西可以撤销
  canUndo() {
    return this.undoStack.length > 0;
  },

  // 是否还有东西可以重做
  canRedo() {
    return this.redoStack.length > 0;
  },

  // 清空历史记录（撤销/重做都清空）
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.triggerUpdate();
  },

  // 通知 UI：撤销/重做按钮状态可能变了
  triggerUpdate() {
    document.dispatchEvent(
      new CustomEvent("historychange", {
        detail: {
          canUndo: this.canUndo(),
          canRedo: this.canRedo(),
        },
      })
    );
  },
};
