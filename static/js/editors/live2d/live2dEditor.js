// Live2D 编辑器入口
import { BaseEditor } from "@utils/BaseEditor.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { attachCharacterList } from "@editors/common/characterList.js";
import { attachEditorCore } from "@editors/common/editorCore.js";
import { attachLayoutUI } from "@editors/common/layoutProperties.js";
import { attachGroupReorder } from "@editors/common/groupedReorder.js";
import { attachUndoRedo } from "@editors/common/undoRedo.js";
import { perfLog } from "@editors/common/perfLogger.js";
import { layoutLog, mutationLog, buildLayoutUndoHooks, runShortcutSteps } from "@editors/common/localShortcutUtils.js";
import { attachLive2DBehavior } from "@editors/live2d/live2dBehavior.js";
import { attachLive2DTimeline } from "@editors/live2d/live2dTimeline.js";
import { attachLive2DDrag } from "@editors/live2d/live2dDrag.js";

// 创建 Live2D 编辑器基础对象
const baseEditor = new BaseEditor({
// 需要重新渲染时走同一个回调
  renderCallback: () => {
    live2dEditor.handleRenderCallback();
  },
  groupSize: 50,
});

export const live2dEditor = {
  modalId: "live2dEditorModal",
  openButtonId: "openLive2dEditorBtn",
  saveButtonId: "saveLayoutsBtn",
  importButtonId: "importLayoutsBtn",
  exportButtonId: "exportLayoutsBtn",
  characterListId: "live2dEditorCharacterList",

  // 常用节点
  domCache: {},
  // 后续布局模式
  nextMode: "move",

  // 初始化编辑器
  init() {
    // 先缓存常用节点
    this.domCache = {
      groupCheckbox: document.getElementById("groupCardsCheckbox"),
      timeline: document.getElementById("live2dEditorTimeline"),
      characterList: document.getElementById("live2dEditorCharacterList"),
      modal: document.getElementById("live2dEditorModal"),
      undoBtn: document.getElementById("live2dUndoBtn"),
      redoBtn: document.getElementById("live2dRedoBtn"),
      modeBtn: document.getElementById(
        "toggleSubsequentLayoutModeBtn"
      ),
      modeText: document.getElementById("subsequentLayoutModeText"),
    };

    const savedMode = storageService.load(STORAGE_KEYS.LIVE2D_SUBSEQUENT_MODE);
    if (savedMode === "hide" || savedMode === "move") {
      this.nextMode = savedMode;
    }

    [
      ["openLive2dEditorBtn", () => this.open()],
      ["autoLayoutBtn", () => this.applyAutoLayout()],
      ["resetLayoutsBtn", () => this.clearAllLayouts()],
      // 给按钮绑定方法
    ].forEach(([buttonId, handler]) => {
      document.getElementById(buttonId)?.addEventListener("click", handler);
    });
    // 切换后续布局模式
    this.domCache.modeBtn?.addEventListener("click", () => this.toggleSubsequentMode());

    // 绑定通用事件
    this.initCommonEvents();

    // 绑定置顶角色按钮
    this.initPinButtonHandler();
  },

  // 打开 Live2D 编辑器
  async open() {
    await this.openProjectEditor({
      // 打开后刷新时间线和拖拽
      afterOpen: async () => {
        // 先清空旧缓存 再重新渲染
        live2dEditor.resetTimelineCache?.();
        live2dEditor.renderViewAndList(() => live2dEditor.renderTimeline());
        live2dEditor.initDragAndDrop();
        live2dEditor.updateSubsequentMode();
        live2dEditor.bindTimelineEvents();
        live2dEditor.domCache.modal?.focus();
      },
    });
  },

  // 关闭前清理状态
  onBeforeClose() {
    this.resetTransientState({
      pendingGroupReorder: null,
      pendingLayoutChange: null,
      pendingLayoutPatch: null,
    });
    this.resetTimelineCache?.();
  },
};

attachGroupReorder(live2dEditor, {
  debugTag: "live2dReorder",
  cardSelector: ".talk-item, .layout-item",
  containerKey: "timeline",
  // 排序失败后继续试别的局部刷新
  onBeforeFullRender: () => {
    const pendingLayout = live2dEditor.pendingLayoutChange;
    const pendingMutation = live2dEditor.pendingLayoutPatch;
    return runShortcutSteps(
      [
        {
          pending: pendingLayout,
          // 尝试只刷新布局字段
          apply: () => live2dEditor.applyLayoutChange(),
          // 命中后记录布局字段日志
          onHit: () => {
            const logParts = layoutLog(pendingLayout);
            perfLog(
              `[PERF][live2d][局部短路] 命中布局属性更新: ${logParts.join(", ")}`
            );
          },
          // 生成布局字段失败原因
          failReason: () =>
            `布局属性更新失败(action=${pendingLayout.actionId || "unknown"})`,
        },
        {
          pending: pendingMutation,
          // 尝试只刷新布局卡片增删
          apply: () => live2dEditor.applyLayoutMutation(),
          // 命中后记录布局卡片日志
          onHit: () => {
            const logParts = mutationLog(pendingMutation);
            perfLog(
              `[PERF][live2d][局部短路] 命中布局卡片增删: ${logParts.join(", ")}`
            );
          },
          // 生成布局卡片失败原因
          failReason: () =>
            `布局卡片增删失败(type=${pendingMutation.type || "unknown"}, action=${
              pendingMutation.actionId || "unknown"
            })`,
        },
      ],
      (failedReasons) => {
        perfLog(
          `[PERF][live2d][局部短路] 回退全量渲染: 原因=${failedReasons.join("; ")}`
        );
      }
    );
  },
  // 都没命中时重画整个时间线
  onFullRender: () => {
    live2dEditor.renderTimeline();
    live2dEditor.renderUsedList();
  },
});

attachEditorCore(live2dEditor, baseEditor);

attachUndoRedo(live2dEditor, {
  debugTag: "live2dUndoRedo",
  ...buildLayoutUndoHooks(live2dEditor),
});

attachLayoutUI(live2dEditor);
attachCharacterList(live2dEditor);

// 把拆开的功能加回编辑器对象
attachLive2DBehavior(live2dEditor);
attachLive2DTimeline(live2dEditor);
attachLive2DDrag(live2dEditor);
