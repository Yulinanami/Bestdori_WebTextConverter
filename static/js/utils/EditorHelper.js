// 编辑器打开关闭保存的通用流程

import { modalService } from "@services/ModalService.js";
import { ui } from "@utils/uiUtils.js";
import { FileUtils } from "@utils/FileUtils.js";

export const EditorHelper = {
  // 打开编辑器
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
      // 先准备数据 再打开窗口
      async () => {
        // 稍等一下让按钮先刷新
        await FileUtils.delay(100);

        // 先跑打开前的方法
        if (beforeOpen) {
          await beforeOpen();
        }

        // 再跑打开后的方法
        if (afterOpen) {
          await afterOpen();
        }

        // 最后打开窗口
        modalService.open(modalId);
      },
      loadingText,
    );
  },

  // 关闭编辑器
  closeEditor(params) {
    const { modalId, beforeClose } = params;

    // 先做关闭前清理
    if (beforeClose) {
      beforeClose();
    }

    // 再关窗口
    modalService.close(modalId);
  },

  // 保存编辑器
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

    // 有按钮时先切到加载状态
    if (buttonId) {
      ui.toggleButtonLoading(buttonId, true, loadingText);
    }

    // 记下开始时间
    const startTime = Date.now();
    const minDisplayTime = 300;

    try {
      if (beforeSave) {
        await beforeSave();
      }

      // 写入这次保存的内容
      await applyChanges();

      // 保存后清空备份
      editor.originalStateOnOpen = null;

      if (afterSave) {
        await afterSave();
      }

      // 让加载状态至少显示一小会
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < minDisplayTime) {
        await FileUtils.delay(minDisplayTime - elapsedTime);
      }
    } finally {
      // 先恢复按钮状态
      if (buttonId) {
        ui.toggleButtonLoading(buttonId, false);
      }

      // 再关窗口
      modalService.close(modalId);
    }
  },
};
