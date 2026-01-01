// 编辑器通用事件合集：撤销/重做、保存/导入/导出、关闭确认、快捷键等
import { historyManager } from "@managers/historyManager.js";

export const EventHandlerMixin = {
  // 初始化：把编辑器常用按钮和快捷键都绑定好
  initCommonEvents() {
    // 撤销/重做按钮
    this.domCache.undoBtn?.addEventListener("click", () =>
      historyManager.undo()
    );
    this.domCache.redoBtn?.addEventListener("click", () =>
      historyManager.redo()
    );

    // 初始化撤销/重做按钮状态（避免复用上一次打开时的 UI 状态）
    if (this.domCache.undoBtn)
      this.domCache.undoBtn.disabled = !historyManager.canUndo();
    if (this.domCache.redoBtn)
      this.domCache.redoBtn.disabled = !historyManager.canRedo();

    // 保存/导入/导出按钮
    document
      .getElementById(this.saveButtonId)
      ?.addEventListener("click", () => this.save());
    document
      .getElementById(this.importButtonId)
      ?.addEventListener("click", () => this.importProject());
    document
      .getElementById(this.exportButtonId)
      ?.addEventListener("click", () => this.exportProject());

    // 关闭弹窗时：如果有未保存更改就先确认
    const handleCloseAttempt = (e) => {
      if (JSON.stringify(this.projectFileState) !== this.originalStateOnOpen) {
        if (!confirm("您有未保存的更改，确定要关闭吗？")) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }
      }
      this._closeEditor();
    };
    this.domCache.modal
      ?.querySelector(".modal-close")
      ?.addEventListener("click", handleCloseAttempt, true);

    // 历史栈变化时：更新撤销/重做按钮是否可点
    document.addEventListener("historychange", (e) => {
      if (this.domCache.undoBtn)
        this.domCache.undoBtn.disabled = !e.detail.canUndo;
      if (this.domCache.redoBtn)
        this.domCache.redoBtn.disabled = !e.detail.canRedo;
    });

    // 快捷键：Ctrl/Cmd+Z 撤销，Ctrl/Cmd+Y 或 Ctrl/Cmd+Shift+Z 重做
    this.domCache.modal?.addEventListener("keydown", (e) => {
      // 忽略在输入框中的按键
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "SELECT" ||
        e.target.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          historyManager.undo();
        } else if (
          e.key === "y" ||
          (e.shiftKey && (e.key === "z" || e.key === "Z"))
        ) {
          e.preventDefault();
          historyManager.redo();
        }
      }
    });
  },
};
