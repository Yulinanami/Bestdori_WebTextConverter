// 统一管理弹窗（打开/关闭/绑定关闭按钮）

class ModalService {
  constructor() {
    // 初始化：记录已打开的弹窗，并防止重复初始化
    this.openModals = new Set();
    this.initialized = false;
    this.specialHandlers = {}; // 某些弹窗需要“自定义关闭方式”时放这里
  }

  init() {
    if (this.initialized) return;

    this._bindCloseButtons();

    this.initialized = true;
  }

  // 给所有关闭按钮绑定点击事件（点了就关闭所在弹窗）
  _bindCloseButtons() {
    document
      .querySelectorAll(".modal-close, .btn-modal-close")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const modalId =
            button.dataset.modalId || button.closest(".modal")?.id;
          if (modalId) {
            this.close(modalId);
          }
        });
      });
  }

  // 打开指定弹窗（modalId 是弹窗 DOM 的 id）
  open(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.warn(`[ModalService] 模态框不存在: ${modalId}`);
      return;
    }

    // 防止 body 滚动
    document.body.classList.add("modal-open");

    // 显示模态框
    modal.style.display = "flex";

    // 记录打开的模态框
    this.openModals.add(modalId);

    // 执行回调
    if (options.onOpen) {
      options.onOpen();
    }
  }

  // 关闭指定弹窗（可传 beforeClose 来拦截关闭，比如未保存时提示）
  close(modalId, beforeClose = null) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.warn(`[ModalService] 模态框不存在: ${modalId}`);
      return;
    }

    // 执行关闭前回调
    if (beforeClose && beforeClose() === false) {
      return;
    }

    // 隐藏模态框
    modal.style.display = "none";

    // 移除记录
    this.openModals.delete(modalId);

    // 如果没有打开的模态框，恢复 body 滚动
    if (this.openModals.size === 0) {
      document.body.classList.remove("modal-open");
    }
  }

  // 弹出“确认/取消”的对话框（返回 Promise<boolean>）
  async confirm(message, _options = {}) {
    return new Promise((resolve) => {
      // 使用原生 confirm（后续可以改为自定义模态框时使用 options.title、confirmText、cancelText）
      const result = window.confirm(message);
      resolve(result);
    });
  }

  // 弹出“只有一个确定按钮”的提示框（返回 Promise<void>）
  async alert(message, _options = {}) {
    return new Promise((resolve) => {
      // 使用原生 alert（后续可以改为自定义模态框时使用 options.title）
      window.alert(message);
      resolve();
    });
  }

  // 弹出“输入框”对话框（返回用户输入的字符串或 null）
  async prompt(message, defaultValue = "") {
    return new Promise((resolve) => {
      // 使用原生 prompt（后续可以改为自定义模态框）
      const result = window.prompt(message, defaultValue);
      resolve(result);
    });
  }
}

// 导出单例（全站共用同一个弹窗管理器）
export const modalService = new ModalService();
