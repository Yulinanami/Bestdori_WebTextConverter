// 动作表情编辑器入口
import { BaseEditor } from "@utils/BaseEditor.js";
import { ui } from "@utils/uiUtils.js";
import { attachEditorCore } from "@editors/common/editorCore.js";
import { attachGroupReorder } from "@editors/common/groupedReorder.js";
import { attachLayoutUI } from "@editors/common/layoutProperties.js";
import { attachLayoutRefresh } from "@editors/common/layoutRefresh.js";
import { attachUndoRedo } from "@editors/common/undoRedo.js";
import { perfLog } from "@editors/common/perfLogger.js";
import { layoutLog, mutationLog, buildLayoutUndoHooks, runShortcutSteps } from "@editors/common/localShortcutUtils.js";
import { summarizeChanges } from "@editors/common/changeSummaryUtils.js";
import { attachExpressionDrag } from "@editors/expression/expressionDrag.js";
import { attachExprRefresh } from "@editors/expression/exprRefresh.js";
import { attachExprActions } from "@editors/expression/expressionBehavior.js";
import { clearExprCache, renderExprCard, renderTimeline } from "@editors/expression/exprTimeline.js";
import { scrollToGroupHeader } from "@editors/common/groupHeaderUtils.js";

// 创建动作表情编辑器基础对象
const baseEditor = new BaseEditor({
  // 需要重新渲染时都走这一层
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
  tempItems: { motion: [], expression: [] },
  quickFill: {
    default: [],
    custom: [],
  },
  // 标记下次要整页刷新
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
          this.removeQuickFill(deleteButton.dataset.value);
          return;
        }

        if (quickFillButton) {
          this.toggleQuickFill(quickFillButton.dataset.type);
        }

        if (quickFillItem) {
          clickEvent.preventDefault();
          const type = quickFillItem.dataset.type;
          const selectedValue = quickFillItem.dataset.value;
          if (type === "add-custom") {
            this.addQuickFillOption();
          } else {
            this.applyQuickFill(type, selectedValue);
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
          pendingGroupReorder: null,
          pendingLayoutChange: null,
          pendingLayoutPatch: null,
          pendingCardRenders: () => new Map(),
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
        // 这次刷新后取消强制整页刷新标记
        this.forceFullRenderOnce = false;
        ui.showStatus("已恢复默认表情动作。", "success");
        clearExprCache();
        renderTimeline(this);
      },
      "恢复中..."
    );
  },

  // 打开动作表情编辑器
  async open() {
    await this.openProjectEditor({
      // 打开前先清空临时库
      beforePrepareProject: () => {
        expressionEditor.tempItems = { motion: [], expression: [] };
      },
      // 打开后刷新时间线和右侧列表
      afterOpen: async () => {
        expressionEditor.loadQuickFillOptions();
        ["motion", "expression"].forEach((type) =>
          expressionEditor.renderQuickFill(type),
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
      pendingGroupReorder: null,
      pendingLayoutChange: null,
      pendingLayoutPatch: null,
      pendingCardRenders: () => new Map(),
      forceFullRenderOnce: false,
    });
    clearExprCache();
    renderTimeline(this);
    this.initTimelineDrag();
    this.renderLibraries();
    this.domCache.modal?.focus();
  },

  // 关闭前清理状态
  onBeforeClose() {
    this.resetTransientState({
      pendingGroupReorder: null,
      pendingLayoutChange: null,
      pendingLayoutPatch: null,
      pendingCardRenders: () => new Map(),
    });
    clearExprCache();
  },

};

attachExprRefresh(expressionEditor);

attachLayoutRefresh(expressionEditor, {
  containerKey: "timeline",
  cardSelector: ".talk-item, .layout-item",
  showToggleButton: false,
  // 新增布局卡片时直接渲染一张
  renderActionCard: renderExprCard,
  // 切换分组后重新渲染并滚到组头
  onGroupToggle: (groupIndex, isOpening) => {
    renderTimeline(expressionEditor);
    if (!isOpening) {
      return;
    }
    setTimeout(() => scrollToGroupHeader(expressionEditor.domCache.timeline, groupIndex), 0);
  },
});

attachGroupReorder(expressionEditor, {
  debugTag: "expressionReorder",
  cardSelector: ".talk-item, .layout-item",
  containerKey: "timeline",
  // 排序失败后继续试别的局部刷新
  onBeforeFullRender: () => {
    // 批量操作时这一轮改走整页刷新
    if (expressionEditor.forceFullRenderOnce) {
      expressionEditor.forceFullRenderOnce = false;
      return false;
    }
    const pendingLayoutPatch = expressionEditor.pendingLayoutPatch;
    const pendingCardSummary = expressionEditor.peekCardSummary();
    const pendingLayoutField = expressionEditor.pendingLayoutChange;
    return runShortcutSteps(
      [
        {
          pending: pendingLayoutPatch,
          // 尝试只刷新布局卡片增删
          apply: () => expressionEditor.applyLayoutMutation(),
          // 命中后记录布局卡片日志
          onHit: () => {
            const logParts = mutationLog(pendingLayoutPatch);
            perfLog(
              `[PERF][expression][局部短路] 命中布局卡片增删: ${logParts.join(", ")}`
            );
          },
          // 生成布局卡片失败原因
          failReason: () =>
            `布局卡片增删失败(type=${pendingLayoutPatch.type || "unknown"}, action=${
              pendingLayoutPatch.actionId || "unknown"
            })`,
        },
        {
          pending: pendingCardSummary,
          // 尝试只刷新动作表情卡片
          apply: () => expressionEditor.applyCardRender(),
          // 命中后记录动作表情日志
          onHit: () => {
            perfLog(
              `[PERF][expression][局部短路] 命中动作/表情卡片更新: ${pendingCardSummary}`
            );
          },
          // 生成动作表情失败原因
          failReason: () => "动作/表情卡片更新失败",
        },
        {
          pending: pendingLayoutField,
          // 尝试只刷新布局字段
          apply: () => expressionEditor.applyLayoutChange(),
          // 命中后记录布局字段日志
          onHit: () => {
            const logParts = layoutLog(pendingLayoutField);
            perfLog(
              `[PERF][expression][局部短路] 命中布局属性更新: ${logParts.join(", ")}`
            );
          },
          // 生成布局字段失败原因
          failReason: () =>
            `布局属性更新失败(action=${pendingLayoutField.actionId || "unknown"})`,
        },
      ],
      (failedReasons) => {
        perfLog(
          `[PERF][expression][局部短路] 回退全量渲染: 原因=${failedReasons.join("; ")}`
        );
      }
    );
  },
  // 都没命中时重画整个时间线
  onFullRender: () => renderTimeline(expressionEditor),
});

attachEditorCore(expressionEditor, baseEditor);

attachUndoRedo(expressionEditor, {
  debugTag: "expressionUndoRedo",
  ...buildLayoutUndoHooks(expressionEditor),
  // 撤销重做时标记卡片局部刷新
  onFieldChanged: ({ actionId, changes, phase }) => {
    const changeSummary = summarizeChanges(changes) || "none";
    expressionEditor.markCardRender(actionId, {
      operation: "undo-redo",
      detail: `source=${phase}, changes=${changeSummary}`,
    });
  },
});

attachLayoutUI(expressionEditor);
attachExprActions(expressionEditor);

// 添加拖拽功能
attachExpressionDrag(expressionEditor);
