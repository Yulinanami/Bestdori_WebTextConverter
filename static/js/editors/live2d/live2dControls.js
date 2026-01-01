import { storageService, STORAGE_KEYS } from "@services/StorageService.js";

// 控制后续拖拽是 move 还是 hide
export function attachLive2dControls(editor) {
  Object.assign(editor, {
    // 切换后续布局模式（move/退场 hide），并保存到本地
    _toggleSubsequentLayoutMode() {
      editor.subsequentLayoutMode =
        editor.subsequentLayoutMode === "move" ? "hide" : "move";
      storageService.set(
        STORAGE_KEYS.LIVE2D_SUBSEQUENT_MODE,
        editor.subsequentLayoutMode
      );
      editor._updateSubsequentModeButton();
    },

    // 更新按钮文字，让用户知道当前模式
    _updateSubsequentModeButton() {
      if (editor.domCache.subsequentModeText) {
        const modeText =
          editor.subsequentLayoutMode === "move" ? "移动" : "退场";
        editor.domCache.subsequentModeText.textContent = `后续: ${modeText}`;
      }
    },
  });
}
