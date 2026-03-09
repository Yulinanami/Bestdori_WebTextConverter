// 管理弹窗开关

class ModalService {
  // 准备弹窗状态
  constructor() {
    // 初始化：记录已打开的弹窗，并防止重复初始化
    this.openModals = new Set();
    this.initialized = false;
    this.specialHandlers = {}; // 某些弹窗的自定义关闭方式
  }

  // 只绑定一次弹窗事件
  init() {
    if (this.initialized) return;

    this._bindCloseButtons();
    this._bindEscClose();

    this.initialized = true;
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
    // 等用户点确定或取消
    return new Promise((resolve) => {
      // 先直接用浏览器自带确认框
      const result = window.confirm(message);
      resolve(result);
    });
  }

  // 弹出“只有一个确定按钮”的提示框（返回 Promise<void>）
  async alert(message, _options = {}) {
    // 等用户关掉提示框
    return new Promise((resolve) => {
      // 先直接用浏览器自带提示框
      window.alert(message);
      resolve();
    });
  }

  // 弹出“输入框”对话框（返回用户输入的字符串或 null）
  async prompt(message, defaultValue = "") {
    // 等用户输完内容
    return new Promise((resolve) => {
      // 先直接用浏览器自带输入框
      const result = window.prompt(message, defaultValue);
      resolve(result);
    });
  }

  // 给关闭按钮绑上弹窗关闭事件
  _bindCloseButtons() {
    document
      .querySelectorAll(".modal-close, .btn-modal-close")
      // 给每个关闭按钮加点击处理
      .forEach((button) => {
        // 点击时关掉对应弹窗
        button.addEventListener("click", () => {
          const modalId =
            button.dataset.modalId || button.closest(".modal")?.id;
          if (modalId) {
            this.close(modalId);
          }
        });
      });
  }

  // 按 Esc 关闭最上层普通弹窗
  _bindEscClose() {
    // 按 Esc 时关掉最上面的普通弹窗
    document.addEventListener("keydown", (keyboardEvent) => {
      if (keyboardEvent.key !== "Escape") {
        return;
      }

      const openedModalIds = Array.from(this.openModals);
      const topModalId = openedModalIds[openedModalIds.length - 1];
      if (!topModalId) {
        return;
      }

      const topModal = document.getElementById(topModalId);
      // 编辑器弹窗继续走自己的关闭逻辑
      if (topModal?.classList.contains("modal-fullscreen")) {
        return;
      }

      keyboardEvent.preventDefault();
      this.close(topModalId);
    });
  }
}

// 导出单例
export const modalService = new ModalService();
