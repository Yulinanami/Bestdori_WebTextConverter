import { storageService, STORAGE_KEYS } from "../../services/StorageService.js";

// 与模式切换相关的 UI 操作
export function attachLive2dControls(editor) {
  Object.assign(editor, {
    /**
     * 切换后续布局模式（移动/退场）
     */
    _toggleSubsequentLayoutMode() {
      editor.subsequentLayoutMode =
        editor.subsequentLayoutMode === "move" ? "hide" : "move";
      storageService.set(
        STORAGE_KEYS.LIVE2D_SUBSEQUENT_MODE,
        editor.subsequentLayoutMode
      );
      editor._updateSubsequentModeButton();
    },

    /**
     * 更新后续布局模式按钮的文本
     */
    _updateSubsequentModeButton() {
      if (editor.domCache.subsequentModeText) {
        const modeText =
          editor.subsequentLayoutMode === "move" ? "移动" : "退场";
        editor.domCache.subsequentModeText.textContent = `后续: ${modeText}`;
      }
    },
  });
}
