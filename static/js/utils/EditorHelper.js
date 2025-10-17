/**
 * 编辑器助手工具 - 提供编辑器生命周期的通用流程
 *
 * 用于处理编辑器的打开、关闭、保存、取消等操作
 */

import { modalService } from "../services/ModalService.js";
import { ui } from "../uiUtils.js";

export const EditorHelper = {
  /**
   * 打开编辑器的通用流程
   * @param {Object} params - 参数对象
   * @param {Object} params.editor - 编辑器实例（必须有 BaseEditor 的方法）
   * @param {string} params.modalId - 模态框ID
   * @param {string} params.buttonId - 触发按钮ID（用于显示加载状态）
   * @param {Function} params.beforeOpen - 打开前的回调（可选）
   * @param {Function} params.afterOpen - 打开后的回调（可选）
   * @param {string} params.loadingText - 加载提示文本（默认："加载中..."）
   */
  async openEditor(params) {
    const {
      editor,
      modalId,
      buttonId,
      beforeOpen,
      afterOpen,
      loadingText = "加载中...",
    } = params;

    await ui.withButtonLoading(
      buttonId,
      async () => {
        // 等待一小段时间，让 UI 更新
        await new Promise((resolve) => setTimeout(resolve, 100));

        // 备份当前状态
        editor.backupState();

        // 执行打开前的回调
        if (beforeOpen) {
          await beforeOpen();
        }

        // 执行打开后的回调（如渲染等）
        if (afterOpen) {
          await afterOpen();
        }

        // 打开模态框
        modalService.open(modalId);
      },
      loadingText
    );
  },

  /**
   * 关闭编辑器的通用流程
   * @param {Object} params - 参数对象
   * @param {string} params.modalId - 模态框ID
   * @param {Function} params.beforeClose - 关闭前的回调（可选）
   */
  closeEditor(params) {
    const { modalId, beforeClose } = params;

    if (beforeClose) {
      beforeClose();
    }

    modalService.close(modalId);
  },

  /**
   * 保存编辑器的通用流程
   * @param {Object} params - 参数对象
   * @param {Object} params.editor - 编辑器实例（必须有 BaseEditor 的方法）
   * @param {string} params.modalId - 模态框ID
   * @param {string} params.buttonId - 保存按钮ID（用于显示加载状态，可选）
   * @param {Function} params.applyChanges - 应用更改的回调
   * @param {Function} params.beforeSave - 保存前的回调（可选）
   * @param {Function} params.afterSave - 保存后的回调（可选）
   * @param {string} params.loadingText - 加载提示文本（默认："保存中..."）
   */
  async saveEditor(params) {
    const {
      editor,
      modalId,
      buttonId,
      applyChanges,
      beforeSave,
      afterSave,
      loadingText = "保存中...",
    } = params;

    // 如果提供了 buttonId，使用加载动画
    if (buttonId) {
      ui.setButtonLoading(buttonId, true, loadingText);
    }

    // 记录开始时间，确保最小显示时间
    const startTime = Date.now();
    const minDisplayTime = 300; // 最小显示300ms

    try {
      if (beforeSave) {
        await beforeSave();
      }

      // 应用更改
      await applyChanges();

      // 清理备份
      editor.clearBackup();

      if (afterSave) {
        await afterSave();
      }

      // 确保加载动画至少显示了最小时间
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < minDisplayTime) {
        await new Promise((resolve) =>
          setTimeout(resolve, minDisplayTime - elapsedTime)
        );
      }
    } finally {
      // 在关闭模态框之前恢复按钮状态
      if (buttonId) {
        ui.setButtonLoading(buttonId, false);
      }

      // 关闭模态框
      modalService.close(modalId);
    }
  },

  /**
   * 取消编辑器的通用流程
   * @param {Object} params - 参数对象
   * @param {Object} params.editor - 编辑器实例（必须有 BaseEditor 的方法）
   * @param {string} params.modalId - 模态框ID
   * @param {Function} params.beforeCancel - 取消前的回调（可选）
   * @param {Function} params.afterCancel - 取消后的回调（可选）
   */
  cancelEditor(params) {
    const { editor, modalId, beforeCancel, afterCancel } = params;

    if (beforeCancel) {
      beforeCancel();
    }

    // 恢复备份状态
    editor.restoreState();

    if (afterCancel) {
      afterCancel();
    }

    // 关闭模态框
    modalService.close(modalId);
  },

  /**
   * 确认关闭编辑器（如果有未保存的更改，显示确认对话框）
   * @param {Object} params - 参数对象
   * @param {Object} params.editor - 编辑器实例（必须有 BaseEditor 的方法）
   * @param {string} params.modalId - 模态框ID
   * @param {string} params.confirmMessage - 确认消息（默认："有未保存的更改，确定要关闭吗？"）
   * @param {Function} params.beforeClose - 关闭前的回调（可选）
   */
  confirmClose(params) {
    const {
      editor,
      modalId,
      confirmMessage = "有未保存的更改，确定要关闭吗？",
      beforeClose,
    } = params;

    if (editor.hasChanges()) {
      if (confirm(confirmMessage)) {
        this.cancelEditor({ editor, modalId, beforeCancel: beforeClose });
      }
    } else {
      this.closeEditor({ modalId, beforeClose });
    }
  },
};
