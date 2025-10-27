// 事件处理 Mixin
// 提供通用的事件监听初始化（撤销/重做、快捷键、模态框关闭等）
import { historyManager } from "../historyManager.js";

export const EventHandlerMixin = {
  /**
   * 初始化通用事件监听
   * 包括：撤销/重做、保存/导入/导出、模态框关闭确认、历史状态变化、快捷键
   */
  initCommonEvents() {
    // 撤销/重做按钮
    this.domCache.undoBtn?.addEventListener("click", () => historyManager.undo());
    this.domCache.redoBtn?.addEventListener("click", () => historyManager.redo());

    // 保存/导入/导出按钮
    document.getElementById(this.saveButtonId)?.addEventListener("click", () => this.save());
    document.getElementById(this.importButtonId)?.addEventListener("click", () => this.importProject());
    document.getElementById(this.exportButtonId)?.addEventListener("click", () => this.exportProject());

    // 模态框关闭确认
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
    this.domCache.modal?.querySelector(".modal-close")?.addEventListener("click", handleCloseAttempt, true);

    // 历史状态变化监听（更新撤销/重做按钮状态）
    document.addEventListener("historychange", (e) => {
      if (this.domCache.modal?.style.display === "flex") {
        if (this.domCache.undoBtn) this.domCache.undoBtn.disabled = !e.detail.canUndo;
        if (this.domCache.redoBtn) this.domCache.redoBtn.disabled = !e.detail.canRedo;
      }
    });

    // 快捷键监听
    this.domCache.modal?.addEventListener("keydown", (e) => {
      // 忽略在输入框中的按键
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          historyManager.undo();
        } else if (e.key === "y" || (e.shiftKey && (e.key === "z" || e.key === "Z"))) {
          e.preventDefault();
          historyManager.redo();
        }
      }
    });
  },
};
