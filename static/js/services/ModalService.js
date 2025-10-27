/**
 * ModalService - 统一的模态框管理服务
 * 提供模态框的打开、关闭、事件绑定等功能
 */

class ModalService {
  constructor() {
    this.openModals = new Set();
    this.initialized = false;
    this.specialHandlers = {}; // 特殊模态框的处理器
  }

  /**
   * 初始化模态框服务
   * 绑定全局事件监听器
   */
  init() {
    if (this.initialized) return;

    // 点击背景关闭模态框
    window.addEventListener("click", (event) => {
      const modals = document.querySelectorAll(".modal");
      modals.forEach((modal) => {
        if (event.target === modal && this.openModals.has(modal.id)) {
          // 检查是否有特殊处理器
          if (this.specialHandlers[modal.id]) {
            this.specialHandlers[modal.id]();
          } else {
            this.close(modal.id);
          }
        }
      });
    });

    // ESC 键关闭模态框
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.openModals.size > 0) {
        // 关闭最后打开的模态框
        const lastModal = Array.from(this.openModals).pop();

        // 检查是否有特殊处理器
        if (this.specialHandlers[lastModal]) {
          this.specialHandlers[lastModal]();
        } else {
          this.close(lastModal);
        }
      }
    });

    // 绑定所有关闭按钮
    this._bindCloseButtons();

    this.initialized = true;
    console.log("[ModalService] 已初始化");
  }

  /**
   * 绑定模态框关闭按钮
   * @private
   */
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

  /**
   * 打开模态框
   * @param {string} modalId - 模态框 ID
   * @param {object} options - 选项
   * @param {Function} options.onOpen - 打开后的回调
   * @param {Function} options.onClose - 关闭前的回调
   */
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

    console.log(`[ModalService] 打开模态框: ${modalId}`);
  }

  /**
   * 关闭模态框
   * @param {string} modalId - 模态框 ID
   * @param {Function} beforeClose - 关闭前的回调，返回 false 可阻止关闭
   */
  close(modalId, beforeClose = null) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.warn(`[ModalService] 模态框不存在: ${modalId}`);
      return;
    }

    // 执行关闭前回调
    if (beforeClose && beforeClose() === false) {
      console.log(`[ModalService] 取消关闭模态框: ${modalId}`);
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

    console.log(`[ModalService] 关闭模态框: ${modalId}`);
  }

  /**
   * 确认对话框
   * @param {string} message - 确认消息
   * @param {object} options - 选项
   * @returns {Promise<boolean>} 是否确认
   */
  async confirm(message, _options = {}) {
    return new Promise((resolve) => {
      // 使用原生 confirm（后续可以改为自定义模态框时使用 options.title、confirmText、cancelText）
      const result = window.confirm(message);
      resolve(result);
    });
  }

  /**
   * 警告对话框
   * @param {string} message - 警告消息
   * @param {object} options - 选项
   */
  async alert(message, _options = {}) {
    return new Promise((resolve) => {
      // 使用原生 alert（后续可以改为自定义模态框时使用 options.title）
      window.alert(message);
      resolve();
    });
  }

  /**
   * 输入对话框
   * @param {string} message - 提示消息
   * @param {string} defaultValue - 默认值
   * @returns {Promise<string|null>} 输入值或 null
   */
  async prompt(message, defaultValue = "") {
    return new Promise((resolve) => {
      // 使用原生 prompt（后续可以改为自定义模态框）
      const result = window.prompt(message, defaultValue);
      resolve(result);
    });
  }
}

// 导出单例
export const modalService = new ModalService();
