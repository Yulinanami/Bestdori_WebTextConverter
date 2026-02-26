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
import { attachLayoutCardLocalRefresh } from "@editors/common/layoutCardLocalRefresh.js";
import { attachUndoRedoLocalShortcut } from "@editors/common/undoRedoLocalShortcut.js";
import { perfLog } from "@editors/common/perfLogger.js";
import {
  buildLayoutLogParts,
  runShortcutSteps,
} from "@editors/common/localShortcutUtils.js";
import {
  summarizeChanges,
} from "@editors/common/changeSummaryUtils.js";
import { attachExpressionDrag } from "@editors/expression/expressionDrag.js";
import { attachExpressionCardLocalRefresh } from "@editors/expression/expressionCardLocalRefresh.js";
import { bindTimelineEvents } from "@editors/expression/expressionTimelineEvents.js";
import {
  createExpressionRenderers,
  renderTimeline,
} from "@editors/expression/expressionTimelineRenderer.js";
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
            onNewProjectCreated: ({ rawText }) => {
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

  // 导入项目后：立即刷新时间线与右侧动作/表情列表
  afterImport() {
    renderTimeline(this);
    libraryPanel.renderLibraries(this);
  },

};

attachExpressionCardLocalRefresh(expressionEditor);

attachLayoutCardLocalRefresh(expressionEditor, {
  // 局部刷新目标容器（动作/表情时间线）。
  getContainer() {
    return this.domCache.timeline;
  },
  cardSelector: ".talk-item, .layout-item",
  showToggleButton: false,
  // 局部新增布局卡片时复用单卡渲染函数。
  renderActionCard(action, actionIndex) {
    return createExpressionRenderers(this).renderSingleCard(action, actionIndex);
  },
  // 分组头开关后重画，并在展开时滚动到对应组头。
  onGroupToggle(groupIndex, isOpening) {
    renderTimeline(this);
    if (!isOpening) {
      return;
    }
    setTimeout(() => {
      const scrollContainer = this.domCache.timeline;
      const header = scrollContainer?.querySelector(
        `.timeline-group-header[data-group-idx="${groupIndex}"]`
      );
      if (
        scrollContainer &&
        header &&
        scrollContainer.scrollTop !== header.offsetTop - 110
      ) {
        scrollContainer.scrollTo({
          top: header.offsetTop - 110,
          behavior: "smooth",
        });
      }
    }, 0);
  },
});

attachGroupedReorderOptimization(expressionEditor, {
  debugTag: "expressionReorder",
  cardSelector: ".talk-item, .layout-item",
  // 分组重排局部短路的目标容器。
  getContainer() {
    return this.domCache.timeline;
  },
  // 排序局部短路失败后，再尝试其它局部短路分支。
  onBeforeFullRender() {
    const pendingLayoutMutation = this.pendingLayoutMutationRender;
    const pendingCardSummary = this.peekPendingExpressionCardSummary();
    const pendingLayoutProperty = this.pendingLayoutPropertyRender;
    return runShortcutSteps(
      [
        {
          pending: pendingLayoutMutation,
          apply: () => this.applyPendingLayoutMutationRender(),
          onHit: () => {
            const logParts = [
              `type=${pendingLayoutMutation.type || "unknown"}`,
              `action=${pendingLayoutMutation.actionId || "unknown"}`,
            ];
            if (pendingLayoutMutation.source) {
              logParts.push(`source=${pendingLayoutMutation.source}`);
            }
            if (pendingLayoutMutation.detail) {
              logParts.push(`详情=${pendingLayoutMutation.detail}`);
            }
            perfLog(
              `[PERF][expression][局部短路] 命中布局卡片增删: ${logParts.join(", ")}`
            );
          },
          failReason: () =>
            `布局卡片增删失败(type=${pendingLayoutMutation.type || "unknown"}, action=${
              pendingLayoutMutation.actionId || "unknown"
            })`,
        },
        {
          pending: pendingCardSummary,
          apply: () => this.applyPendingExpressionCardRender(),
          onHit: () => {
            perfLog(
              `[PERF][expression][局部短路] 命中动作/表情卡片更新: ${pendingCardSummary}`
            );
          },
          failReason: () => "动作/表情卡片更新失败",
        },
        {
          pending: pendingLayoutProperty,
          apply: () => this.applyPendingLayoutPropertyRender(),
          onHit: () => {
            const logParts = buildLayoutLogParts(pendingLayoutProperty);
            perfLog(
              `[PERF][expression][局部短路] 命中布局属性更新: ${logParts.join(", ")}`
            );
          },
          failReason: () =>
            `布局属性更新失败(action=${pendingLayoutProperty.actionId || "unknown"})`,
        },
      ],
      (failedReasons) => {
        perfLog(
          `[PERF][expression][局部短路] 回退全量渲染: 原因=${failedReasons.join("; ")}`
        );
      }
    );
  },
  // 所有局部短路都未命中时，执行全量重绘。
  onFullRender() {
    renderTimeline(this);
  },
});

attachUndoRedoLocalShortcut(baseEditor, {
  debugTag: "expressionUndoRedo",
  // 撤销/恢复导致新增布局卡片时，标记布局增删局部短路。
  onActionAdded({ actionAfter, summary, phase }) {
    if (actionAfter?.type === "layout") {
      expressionEditor.markLayoutMutationRender(actionAfter.id, "add", {
        source: phase,
        detail: summary,
      });
    }
  },
  // 撤销/恢复导致删除布局卡片时，标记布局增删局部短路。
  onActionRemoved({ actionBefore, summary, phase }) {
    if (actionBefore?.type === "layout") {
      expressionEditor.markLayoutMutationRender(actionBefore.id, "delete", {
        source: phase,
        detail: summary,
      });
    }
  },
  // 撤销/恢复触发排序变化时，标记排序局部短路。
  onActionOrderChanged({ phase, orderSummary }) {
    expressionEditor.markGroupedReorderRender("state", phase, orderSummary);
  },
  // 撤销/恢复触发布局字段变化时，标记布局属性局部短路。
  onLayoutFieldChanged({ actionId, actionAfter, changes, phase }) {
    if (actionAfter?.type === "layout") {
      expressionEditor.markLayoutPropertyRender(actionId, {
        source: phase,
        changes,
      });
    }
  },
  // 撤销/恢复触发动作/表情字段变化时，标记卡片 footer 局部短路。
  onExpressionFieldChanged({ actionId, changes, phase }) {
    const changeSummary = summarizeChanges(changes) || "none";
    expressionEditor.markExpressionCardRender(actionId, {
      operation: "undo-redo",
      detail: `source=${phase}, changes=${changeSummary}`,
    });
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
