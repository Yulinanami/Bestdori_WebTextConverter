import { libraryPanel } from "./libraries/libraryPanel.js";
import { quickFill } from "./libraries/quickFill.js";

// 资源库、临时项与快速填充相关逻辑
export function attachExpressionLibraries(editor) {
  Object.assign(editor, {
    initDragAndDropForLibraries() {
      libraryPanel.initDragAndDropForLibraries(editor);
    },

    renderLibraries() {
      libraryPanel.renderLibraries(editor);
    },

    _renderLibrary(type, items) {
      libraryPanel.renderLibrary(type, items);
    },

    _filterLibraryList(type, event) {
      libraryPanel.filterLibraryList(type, event);
    },

    _addTempItem(type) {
      libraryPanel.addTempItem(editor, type);
    },

    _openLive2dViewers() {
      libraryPanel.openLive2dViewers(editor);
    },

    _loadQuickFillOptions() {
      libraryPanel.loadQuickFillOptions(editor);
    },

    _renderQuickFillDropdowns() {
      quickFill.renderQuickFillDropdowns(editor);
    },

    _renderQuickFillDropdown(type) {
      quickFill.renderQuickFillDropdown(editor, type);
    },

    _toggleQuickFillDropdown(type) {
      quickFill.toggleQuickFillDropdown(type);
    },

    _handleQuickFillSelect(type, value) {
      quickFill.handleQuickFillSelect(type, value);
    },

    async _addCustomQuickFillOption() {
      await quickFill.addCustomQuickFillOption(editor);
    },

    async _deleteCustomQuickFillOption(valueToDelete) {
      await quickFill.deleteCustomQuickFillOption(editor, valueToDelete);
    },

    _getCustomQuickFillOptions() {
      return quickFill.getCustomQuickFillOptions();
    },
  });
}
