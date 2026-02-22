import { libraryPanel } from "@editors/expression/libraries/libraryPanel.js";
import { quickFill } from "@editors/expression/libraries/quickFill.js";

// 给 expressionEditor：渲染动作/表情库、搜索、临时项、快速填充
export function attachExpressionLibraries(editor) {
  Object.assign(editor, {
    // 刷新右侧动作/表情库（会按在场角色过滤）
    renderLibraries() {
      libraryPanel.renderLibraries(editor);
    },

    // 渲染某一个库（motion/expression）
    renderLibrary(type, items) {
      libraryPanel.renderLibrary(type, items);
    },

    // 给右侧库初始化拖拽（拖到分配区/卡片上）
    initDragAndDropForLibraries() {
      libraryPanel.initDragAndDropForLibraries(editor);
    },

    // 按搜索词过滤库列表
    filterLibraryList(type, event) {
      libraryPanel.filterLibraryList(type, event);
    },

    // 读取快速填充选项（默认 + 自定义）
    loadQuickFillOptions() {
      libraryPanel.loadQuickFillOptions(editor);
    },

    // 读取本地保存的自定义快速填充项
    getCustomQuickFillOptions() {
      return quickFill.getCustomQuickFillOptions();
    },

    // 渲染两个快速填充下拉框（动作/表情）
    renderQuickFillDropdowns() {
      quickFill.renderQuickFillDropdowns(editor);
    },

    // 渲染一个快速填充下拉框（动作或表情）
    renderQuickFillDropdown(type) {
      quickFill.renderQuickFillDropdown(editor, type);
    },

    // 展开/收起快速填充下拉框
    toggleQuickFillDropdown(type) {
      quickFill.toggleQuickFillDropdown(type);
    },

    // 点选快速填充项后：把值写到搜索框里并触发过滤
    handleQuickFillSelect(type, value) {
      quickFill.handleQuickFillSelect(type, value);
    },

    // 添加一个临时自定义项（只在本次打开编辑器时有效）
    addTempItem(type) {
      libraryPanel.addTempItem(editor, type);
    },

    // 打开 Live2D 浏览器（可按时间线里出现的服装批量打开）
    openLive2DViewers() {
      libraryPanel.openLive2DViewers(editor);
    },

    // 新增一个自定义快速填充项
    async addCustomQuickFillOption() {
      await quickFill.addCustomQuickFillOption(editor);
    },

    // 删除一个自定义快速填充项
    async deleteCustomQuickFillOption(valueToDelete) {
      await quickFill.deleteCustomQuickFillOption(editor, valueToDelete);
    },
  });
}
