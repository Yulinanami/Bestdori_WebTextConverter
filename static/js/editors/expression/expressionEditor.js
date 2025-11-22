// 动作表情编辑器（模块化入口）
import { BaseEditor } from "@utils/BaseEditor.js";
import { EditorHelper } from "@utils/EditorHelper.js";
import { ui } from "@utils/uiUtils.js";
import { BaseEditorMixin } from "@mixins/BaseEditorMixin.js";
import { EventHandlerMixin } from "@mixins/EventHandlerMixin.js";
import { LayoutPropertyMixin } from "@mixins/LayoutPropertyMixin.js";
import { ScrollAnimationMixin } from "@mixins/ScrollAnimationMixin.js";
import { applyStateBridge } from "@editors/common/stateBridge.js";
import { attachExpressionAssignments } from "@editors/expression/expressionAssignments.js";
import { attachExpressionTimeline } from "@editors/expression/expressionTimeline.js";
import { attachExpressionDrag } from "@editors/expression/expressionDrag.js";
import { attachExpressionLibraries } from "@editors/expression/expressionLibraries.js";

// 创建基础编辑器实例
const baseEditor = new BaseEditor({
  renderCallback: () => {
    expressionEditor.renderTimeline();
  },
  groupSize: 50,
});

export const expressionEditor = {
  baseEditor,
  modalId: "expressionEditorModal",
  saveButtonId: "saveExpressionsBtn",
  importButtonId: "importExpressionsBtn",
  exportButtonId: "exportExpressionsBtn",

  // DOM 缓存
  domCache: {},
  tempLibraryItems: { motion: [], expression: [] },
  quickFillOptions: {
    default: [],
    custom: [],
  },

  init() {
    // 缓存 DOM 元素
    this.domCache = {
      groupCheckbox: document.getElementById("groupCardsCheckbox"),
      timeline: document.getElementById("expressionEditorTimeline"),
      modal: document.getElementById("expressionEditorModal"),
      undoBtn: document.getElementById("expressionUndoBtn"),
      redoBtn: document.getElementById("expressionRedoBtn"),
      motionList: document.getElementById("motionLibraryList"),
      expressionList: document.getElementById("expressionLibraryList"),
    };

    document
      .getElementById("openExpressionEditorBtn")
      ?.addEventListener("click", () => this.open());
    document
      .getElementById("resetExpressionsBtn")
      ?.addEventListener("click", () => this.reset());
    document
      .getElementById("addTempMotionBtn")
      ?.addEventListener("click", () => this._addTempItem("motion"));
    document
      .getElementById("addTempExpressionBtn")
      ?.addEventListener("click", () => this._addTempItem("expression"));
    document
      .getElementById("live2dViewerBtn")
      ?.addEventListener("click", () => this._openLive2dViewers());

    const setupSearchClear = (inputId, clearBtnId) => {
      const input = document.getElementById(inputId);
      const clearBtn = document.getElementById(clearBtnId);
      if (!input || !clearBtn) return;
      input.addEventListener("input", () => {
        clearBtn.style.display = input.value ? "block" : "none";
      });

      clearBtn.addEventListener("click", () => {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      });
    };

    setupSearchClear("motionSearchInput", "clearMotionSearchBtn");
    setupSearchClear("expressionSearchInput", "clearExpressionSearchBtn");
    document
      .getElementById("motionSearchInput")
      ?.addEventListener("input", (e) => this._filterLibraryList("motion", e));
    document
      .getElementById("expressionSearchInput")
      ?.addEventListener("input", (e) =>
        this._filterLibraryList("expression", e)
      );

    const libraryContainer = document.getElementById("expressionEditorLibrary");
    if (libraryContainer) {
      libraryContainer.addEventListener("click", (e) => {
        const quickFillBtn = e.target.closest(".quick-fill-btn");
        const quickFillItem = e.target.closest(".quick-fill-item");
        const deleteBtn = e.target.closest(".quick-fill-delete-btn");

        if (deleteBtn) {
          // 优先处理删除按钮
          e.stopPropagation(); // 阻止事件冒泡到 quickFillItem
          this._deleteCustomQuickFillOption(deleteBtn.dataset.value);
          return;
        }

        if (quickFillBtn) {
          this._toggleQuickFillDropdown(quickFillBtn.dataset.type);
        }

        if (quickFillItem) {
          e.preventDefault();
          const type = quickFillItem.dataset.type;
          const value = quickFillItem.dataset.value;
          if (type === "add-custom") {
            this._addCustomQuickFillOption();
          } else {
            this._handleQuickFillSelect(type, value);
          }
        }
      });
    }

    // 初始化通用事件
    this.initCommonEvents();
  },

  afterImport() {
    this.renderTimeline();
  },

  _createActionFromSegment(index, text, speakers) {
    return {
      id: `action-id-${Date.now()}-${index}`,
      type: "talk",
      text: text,
      speakers: speakers,
      motions: [],
    };
  },

  // 恢复默认表情动作（清空所有角色状态配置）
  async reset() {
    if (!confirm("确定要恢复默认表情动作吗？此操作可以撤销。")) {
      return;
    }

    const resetBtn = document.getElementById("resetExpressionsBtn");
    const originalText = resetBtn?.textContent;
    if (resetBtn) resetBtn.textContent = "恢复中...";

    try {
      this._executeCommand((currentState) => {
        currentState.actions.forEach((action) => {
          if (action.type === "talk") action.motions = [];
          else if (action.type === "layout") action.initialState = {};
        });
      });
      ui.showStatus("已恢复默认表情动作。", "success");
    } finally {
      if (resetBtn && originalText) resetBtn.textContent = originalText;
    }
  },

  // 打开表情动作编辑器模态框
  async open() {
    await EditorHelper.openEditor({
      editor: baseEditor,
      modalId: "expressionEditorModal",
      buttonId: "openExpressionEditorBtn",
      loadingText: "加载中...",
      beforeOpen: async () => {
        try {
          this.tempLibraryItems = { motion: [], expression: [] };
          await this._prepareProjectState({
            onExistingProjectLoaded: () =>
              ui.showStatus("已加载现有项目进度。", "info"),
            onNewProjectCreated: (_, { rawText }) => {
              if (rawText?.trim()) {
                ui.showStatus("已根据当前文本创建新项目。", "info");
              }
            },
          });
        } catch (error) {
          ui.showStatus(
            `加载编辑器失败: ${error.response?.data?.error || error.message}`,
            "error"
          );
          throw error;
        }
      },
      afterOpen: async () => {
        this._loadQuickFillOptions();
        this._renderQuickFillDropdowns();
        const motionSearch = document.getElementById("motionSearchInput");
        const expressionSearch = document.getElementById(
          "expressionSearchInput"
        );
        if (motionSearch) motionSearch.value = "";
        if (expressionSearch) expressionSearch.value = "";

        this.renderTimeline();
        this.bindTimelineEvents();
        this.initTimelineDrag();
        this.renderLibraries();

        this.domCache.modal?.focus();
      },
    });
  },

  // 使用 BaseEditor 的 executeCommand 方法
  _executeCommand(changeFn) {
    baseEditor.executeCommand(changeFn);
  },
};

// 状态代理
applyStateBridge(expressionEditor, baseEditor);

// 应用 mixins
Object.assign(
  expressionEditor,
  BaseEditorMixin,
  EventHandlerMixin,
  LayoutPropertyMixin,
  ScrollAnimationMixin
);

// 注入拆分后的功能模块
attachExpressionAssignments(expressionEditor);
attachExpressionTimeline(expressionEditor);
attachExpressionDrag(expressionEditor, baseEditor);
attachExpressionLibraries(expressionEditor);
