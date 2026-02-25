// 给每一句对话/每个布局设置动作与表情，提供时间线编辑
import { BaseEditor } from "@utils/BaseEditor.js";
import { EditorHelper } from "@utils/EditorHelper.js";
import { ui } from "@utils/uiUtils.js";
import { BaseEditorMixin } from "@mixins/BaseEditorMixin.js";
import { EventHandlerMixin } from "@mixins/EventHandlerMixin.js";
import { LayoutPropertyMixin } from "@mixins/LayoutPropertyMixin.js";
import { ScrollAnimationMixin } from "@mixins/ScrollAnimationMixin.js";
import { applyStateBridge } from "@editors/common/stateBridge.js";
import { attachGroupedReorderOptimization } from "@editors/common/groupedReorderOptimization.js";
import { attachExpressionDrag } from "@editors/expression/expressionDrag.js";
import { bindTimelineEvents } from "@editors/expression/expressionTimelineEvents.js";
import { renderTimeline } from "@editors/expression/expressionTimelineRenderer.js";
import { libraryPanel } from "@editors/expression/expressionLibraryPanel.js";
import { quickFill } from "@editors/expression/expressionQuickFill.js";

// 创建一个通用的 BaseEditor（负责分组渲染、撤销/重做等）
const baseEditor = new BaseEditor({
  renderCallback: () => {
    expressionEditor.handleRenderCallback();
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

  // 初始化：缓存 DOM、绑定按钮事件、绑定搜索与快捷填充交互
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
      ?.addEventListener("click", () =>
        libraryPanel.addTempItem(this, "motion")
      );
    document
      .getElementById("addTempExpressionBtn")
      ?.addEventListener("click", () =>
        libraryPanel.addTempItem(this, "expression")
      );
    document
      .getElementById("live2dViewerBtn")
      ?.addEventListener("click", () => libraryPanel.openLive2DViewers(this));

    // 给搜索框加一个“清空按钮”（输入时显示，点一下清空）
    const setupSearchClear = (inputId, clearBtnId) => {
      const searchInput = document.getElementById(inputId);
      const clearButton = document.getElementById(clearBtnId);
      if (!searchInput || !clearButton) return;
      searchInput.addEventListener("input", () => {
        clearButton.style.display = searchInput.value ? "block" : "none";
      });

      clearButton.addEventListener("click", () => {
        searchInput.value = "";
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        searchInput.focus();
      });
    };

    setupSearchClear("motionSearchInput", "clearMotionSearchBtn");
    setupSearchClear("expressionSearchInput", "clearExpressionSearchBtn");
    document
      .getElementById("motionSearchInput")
      ?.addEventListener("input", (inputEvent) =>
        libraryPanel.filterLibraryList("motion", inputEvent)
      );
    document
      .getElementById("expressionSearchInput")
      ?.addEventListener("input", (inputEvent) =>
        libraryPanel.filterLibraryList("expression", inputEvent)
      );

    const libraryContainer = document.getElementById("expressionEditorLibrary");
    if (libraryContainer) {
      libraryContainer.addEventListener("click", (clickEvent) => {
        const quickFillButton = clickEvent.target.closest(".quick-fill-btn");
        const quickFillItem = clickEvent.target.closest(".quick-fill-item");
        const deleteButton = clickEvent.target.closest(".quick-fill-delete-btn");

        if (deleteButton) {
          // 优先处理删除按钮
          clickEvent.stopPropagation(); // 阻止事件冒泡到 quickFillItem
          quickFill.deleteCustomQuickFillOption(this, deleteButton.dataset.value);
          return;
        }

        if (quickFillButton) {
          quickFill.toggleQuickFillDropdown(quickFillButton.dataset.type);
        }

        if (quickFillItem) {
          clickEvent.preventDefault();
          const type = quickFillItem.dataset.type;
          const selectedValue = quickFillItem.dataset.value;
          if (type === "add-custom") {
            quickFill.addCustomQuickFillOption(this);
          } else {
            quickFill.handleQuickFillSelect(type, selectedValue);
          }
        }
      });
    }

    // 初始化通用事件
    this.initCommonEvents();
  },

  // 恢复默认：清空所有对话/布局上的动作与表情设置（可撤销）
  async reset() {
    if (!confirm("确定要恢复默认表情动作吗？此操作可以撤销。")) {
      return;
    }

    const resetButton = document.getElementById("resetExpressionsBtn");
    const originalText = resetButton?.textContent;
    if (resetButton) resetButton.textContent = "恢复中...";

    try {
      this.baseEditor.executeCommand((currentState) => {
        currentState.actions.forEach((action) => {
          if (action.type === "talk") action.motions = [];
          else if (action.type === "layout") {
            delete action.initialState;
            delete action.delay;
          }
        });
      });
      ui.showStatus("已恢复默认表情动作。", "success");
      renderTimeline(this);
    } finally {
      if (resetButton && originalText) resetButton.textContent = originalText;
    }
  },

  // 打开动作/表情编辑器弹窗，并加载/创建项目数据
  async open() {
    await EditorHelper.openEditor({
      editor: baseEditor,
      modalId: "expressionEditorModal",
      buttonId: "openExpressionEditorBtn",
      loadingText: "加载中...",
      beforeOpen: async () => {
        try {
          this.tempLibraryItems = { motion: [], expression: [] };
          await this.prepareProjectState({
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
        libraryPanel.loadQuickFillOptions(this);
        quickFill.renderQuickFillDropdowns(this);
        const motionSearch = document.getElementById("motionSearchInput");
        const expressionSearch = document.getElementById(
          "expressionSearchInput"
        );
        if (motionSearch) motionSearch.value = "";
        if (expressionSearch) expressionSearch.value = "";

        renderTimeline(this);
        bindTimelineEvents(this);
        this.initTimelineDrag();
        libraryPanel.renderLibraries(this);

        this.domCache.modal?.focus();
      },
    });
  },

};

attachGroupedReorderOptimization(expressionEditor, {
  cardSelector: ".talk-item, .layout-item",
  getContainer() {
    return this.domCache.timeline;
  },
  onFullRender() {
    renderTimeline(this);
  },
});

// 状态桥接：让 expressionEditor 直接拥有 projectFileState 等字段
applyStateBridge(expressionEditor, baseEditor);

// 混入通用能力（保存/事件/布局控件/滚动等）
Object.assign(
  expressionEditor,
  BaseEditorMixin,
  EventHandlerMixin,
  LayoutPropertyMixin,
  ScrollAnimationMixin
);

// 注入拖拽排序能力
attachExpressionDrag(expressionEditor, baseEditor);
