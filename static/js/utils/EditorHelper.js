// 编辑器流程助手：统一处理打开/关闭/保存这些重复流程（显示 loading、开关弹窗等）。

import { modalService } from "@services/ModalService.js";
import { ui } from "@utils/uiUtils.js";
import { FileUtils } from "@utils/FileUtils.js";

export const EditorHelper = {
  // 打开编辑器的通用流程（先跑 beforeOpen/afterOpen，再打开弹窗）
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
        await FileUtils.delay(100);

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
      loadingText,
    );
  },

  // 关闭编辑器的通用流程（先做 beforeClose 清理，再关弹窗）
  closeEditor(params) {
    const { modalId, beforeClose } = params;

    if (beforeClose) {
      beforeClose();
    }

    modalService.close(modalId);
  },

  // 保存编辑器的通用流程（显示 loading，执行 applyChanges，保存后关闭弹窗）
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
        await FileUtils.delay(minDisplayTime - elapsedTime);
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
};
