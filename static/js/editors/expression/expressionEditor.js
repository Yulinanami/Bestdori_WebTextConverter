// 动作表情编辑器入口
import { BaseEditor } from "@utils/BaseEditor.js";
import { ui } from "@utils/uiUtils.js";
import { attachEditorCore } from "@editors/common/editorCore.js";
import { attachGroupedReorderOptimization } from "@editors/common/groupedReorderOptimization.js";
import { attachLayoutProperties } from "@editors/common/layoutProperties.js";
import { attachLayoutCardLocalRefresh } from "@editors/common/layoutCardLocalRefresh.js";
import { attachUndoRedoLocalShortcut } from "@editors/common/undoRedoLocalShortcut.js";
import { perfLog } from "@editors/common/perfLogger.js";
import {
  buildLayoutLogParts,
  buildMutationLogParts,
  createLayoutUndoRedoHandlers,
  runShortcutSteps,
} from "@editors/common/localShortcutUtils.js";
import { summarizeChanges } from "@editors/common/changeSummaryUtils.js";
import { attachExpressionDrag } from "@editors/expression/expressionDrag.js";
import { attachExpressionCardLocalRefresh } from "@editors/expression/expressionCardLocalRefresh.js";
import { attachExpressionBehavior } from "@editors/expression/expressionBehavior.js";
import {
  renderExpressionActionCard,
  resetExpressionTimelineCache,
  renderTimeline,
} from "@editors/expression/expressionTimelineRenderer.js";
import { scrollToGroupHeader } from "@editors/common/groupHeaderUtils.js";

// 创建动作表情编辑器基础对象
const baseEditor = new BaseEditor({
// 需要重新渲染时走同一个回调
  renderCallback: () => {
    expressionEditor.handleRenderCallback();
  },
  groupSize: 50,
});

export const expressionEditor = {
  modalId: "expressionEditorModal",
  openButtonId: "openExpressionEditorBtn",
  saveButtonId: "saveExpressionsBtn",
  importButtonId: "importExpressionsBtn",
  exportButtonId: "exportExpressionsBtn",

  // 常用节点
  domCache: {},
  tempLibraryItems: { motion: [], expression: [] },
  quickFillOptions: {
    default: [],
    custom: [],
  },
  // 标记下次必须整页刷新
  forceFullRenderOnce: false,

  // 初始化编辑器
  init() {
    // 先缓存常用节点
    this.domCache = {
      groupCheckbox: document.getElementById("groupCardsCheckbox"),
      timeline: document.getElementById("expressionEditorTimeline"),
      modal: document.getElementById("expressionEditorModal"),
      undoBtn: document.getElementById("expressionUndoBtn"),
      redoBtn: document.getElementById("expressionRedoBtn"),
      motionList: document.getElementById("motionLibraryList"),
      expressionList: document.getElementById("expressionLibraryList"),
    };

    [
      ["openExpressionEditorBtn", () => this.open()],
      ["resetExpressionsBtn", () => this.reset()],
      ["addTempMotionBtn", () => this.addTempItem("motion")],
      ["addTempExpressionBtn", () => this.addTempItem("expression")],
      ["live2dViewerBtn", () => this.openLive2DViewers()],
      // 给按钮绑定方法
    ].forEach(([buttonId, handler]) => {
      document.getElementById(buttonId)?.addEventListener("click", handler);
    });

    // 给搜索框绑定输入和清空
    const setupSearchInput = (type, inputId, clearBtnId) => {
      const searchInput = document.getElementById(inputId);
      const clearButton = document.getElementById(clearBtnId);
      if (!searchInput || !clearButton) return;
      // 输入时过滤列表
      searchInput.addEventListener("input", () => {
        clearButton.style.display = searchInput.value ? "block" : "none";
        this.filterLibraryList(type, { target: searchInput });
      });

      // 点击时清空搜索框
      clearButton.addEventListener("click", () => {
        searchInput.value = "";
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        searchInput.focus();
      });
    };

    [
      ["motion", "motionSearchInput", "clearMotionSearchBtn"],
      ["expression", "expressionSearchInput", "clearExpressionSearchBtn"],
    ].forEach((args) => setupSearchInput(...args));

    const libraryContainer = document.getElementById("expressionEditorLibrary");
    if (libraryContainer) {
      libraryContainer.addEventListener("click", (clickEvent) => {
        const quickFillButton = clickEvent.target.closest(".quick-fill-btn");
        const quickFillItem = clickEvent.target.closest(".quick-fill-item");
        const deleteButton = clickEvent.target.closest(".quick-fill-delete-btn");

        if (deleteButton) {
          // 先处理删除
          clickEvent.stopPropagation();
          this.deleteCustomQuickFillOption(deleteButton.dataset.value);
          return;
        }

        if (quickFillButton) {
          this.toggleQuickFillDropdown(quickFillButton.dataset.type);
        }

        if (quickFillItem) {
          clickEvent.preventDefault();
          const type = quickFillItem.dataset.type;
          const selectedValue = quickFillItem.dataset.value;
          if (type === "add-custom") {
            this.addCustomQuickFillOption();
          } else {
            this.handleQuickFillSelect(type, selectedValue);
          }
        }
      });
    }

    // 初始化通用事件
    this.initCommonEvents();
  },

  // 恢复默认设置
  async reset() {
    if (!confirm("确定要恢复默认表情动作吗？此操作可以撤销。")) {
      return;
    }

    await ui.withButtonLoading(
      "resetExpressionsBtn",
      async () => {
        // 先清空局部刷新标记
        this.resetTransientState({
          pendingGroupedReorderRender: null,
          pendingLayoutPropertyRender: null,
          pendingLayoutMutationRender: null,
          pendingExpressionCardRenders: () => new Map(),
          forceFullRenderOnce: true,
        });
        this.executeCommand((currentState) => {
          currentState.actions.forEach((action) => {
            // 清空动作表情数据
            if (Array.isArray(action.motions)) {
              action.motions = [];
            }
            if (action.type === "layout") {
              delete action.initialState;
              delete action.delay;
            }
          });
        });
        // 这次刷新后取消强制整页刷新
        this.forceFullRenderOnce = false;
        ui.showStatus("已恢复默认表情动作。", "success");
        resetExpressionTimelineCache();
        renderTimeline(this);
      },
      "恢复中..."
    );
  },

  // 打开动作表情编辑器
  async open() {
    await this.openProjectEditor({
      // 打开前先清空临时库
      beforePrepareProjectState: () => {
        expressionEditor.tempLibraryItems = { motion: [], expression: [] };
      },
      // 打开后刷新时间线和右侧列表
      afterOpen: async () => {
        expressionEditor.loadQuickFillOptions();
        ["motion", "expression"].forEach((type) =>
          expressionEditor.renderQuickFillDropdown(type),
        );
        const motionSearch = document.getElementById("motionSearchInput");
        const expressionSearch = document.getElementById(
          "expressionSearchInput"
        );
        if (motionSearch) motionSearch.value = "";
        if (expressionSearch) expressionSearch.value = "";

        renderTimeline(expressionEditor);
        expressionEditor.bindTimelineEvents();
        expressionEditor.initTimelineDrag();
        expressionEditor.renderLibraries();
        expressionEditor.domCache.modal?.focus();
      },
    });
  },

  // 导入项目后立刻重画当前编辑器
  afterImport() {
    this.resetTransientState({
      pendingGroupedReorderRender: null,
      pendingLayoutPropertyRender: null,
      pendingLayoutMutationRender: null,
      pendingExpressionCardRenders: () => new Map(),
      forceFullRenderOnce: false,
    });
    resetExpressionTimelineCache();
    renderTimeline(this);
    this.initTimelineDrag();
    this.renderLibraries();
    this.domCache.modal?.focus();
  },

  // 关闭前清理状态
  onBeforeClose() {
    this.resetTransientState({
      pendingGroupedReorderRender: null,
      pendingLayoutPropertyRender: null,
      pendingLayoutMutationRender: null,
      pendingExpressionCardRenders: () => new Map(),
    });
    resetExpressionTimelineCache();
  },

};

attachExpressionCardLocalRefresh(expressionEditor);

attachLayoutCardLocalRefresh(expressionEditor, {
  containerKey: "timeline",
  cardSelector: ".talk-item, .layout-item",
  showToggleButton: false,
// 新增布局卡片时直接渲染一张
  renderActionCard: renderExpressionActionCard,
  // 切换分组后重新渲染并滚到组头
  onGroupToggle: (groupIndex, isOpening) => {
    renderTimeline(expressionEditor);
    if (!isOpening) {
      return;
    }
    setTimeout(() => scrollToGroupHeader(expressionEditor.domCache.timeline, groupIndex), 0);
  },
});

attachGroupedReorderOptimization(expressionEditor, {
  debugTag: "expressionReorder",
  cardSelector: ".talk-item, .layout-item",
  containerKey: "timeline",
  // 排序失败后继续试别的局部刷新
  onBeforeFullRender: () => {
    // 批量操作时这一轮直接整页刷新
    if (expressionEditor.forceFullRenderOnce) {
      expressionEditor.forceFullRenderOnce = false;
      return false;
    }
    const pendingLayoutMutation = expressionEditor.pendingLayoutMutationRender;
    const pendingCardSummary = expressionEditor.peekPendingExpressionCardSummary();
    const pendingLayoutProperty = expressionEditor.pendingLayoutPropertyRender;
    return runShortcutSteps(
      [
        {
          pending: pendingLayoutMutation,
          apply: () => expressionEditor.applyPendingLayoutMutationRender(),
          onHit: () => {
            const logParts = buildMutationLogParts(pendingLayoutMutation);
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
          apply: () => expressionEditor.applyPendingExpressionCardRender(),
          onHit: () => {
            perfLog(
              `[PERF][expression][局部短路] 命中动作/表情卡片更新: ${pendingCardSummary}`
            );
          },
          failReason: () => "动作/表情卡片更新失败",
        },
        {
          pending: pendingLayoutProperty,
          apply: () => expressionEditor.applyPendingLayoutPropertyRender(),
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
  // 都没命中时重新渲染整页
  onFullRender: () => renderTimeline(expressionEditor),
});

attachEditorCore(expressionEditor, baseEditor);

attachUndoRedoLocalShortcut(expressionEditor, {
  debugTag: "expressionUndoRedo",
  ...createLayoutUndoRedoHandlers(expressionEditor),
  // 撤销重做时标记卡片局部刷新
  onExpressionFieldChanged: ({ actionId, changes, phase }) => {
    const changeSummary = summarizeChanges(changes) || "none";
    expressionEditor.markExpressionCardRender(actionId, {
      operation: "undo-redo",
      detail: `source=${phase}, changes=${changeSummary}`,
    });
  },
});

attachLayoutProperties(expressionEditor);
attachExpressionBehavior(expressionEditor);

// 添加拖拽功能
attachExpressionDrag(expressionEditor);
