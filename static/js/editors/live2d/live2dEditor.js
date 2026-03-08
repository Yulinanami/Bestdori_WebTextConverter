// Live2D 编辑器入口
import { BaseEditor } from "@utils/BaseEditor.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { attachCharacterList } from "@editors/common/characterList.js";
import { attachEditorCore } from "@editors/common/editorCore.js";
import { attachLayoutProperties } from "@editors/common/layoutProperties.js";
import { attachGroupedReorderOptimization } from "@editors/common/groupedReorderOptimization.js";
import { attachLayoutCardLocalRefresh } from "@editors/common/layoutCardLocalRefresh.js";
import { attachUndoRedoLocalShortcut } from "@editors/common/undoRedoLocalShortcut.js";
import { perfLog } from "@editors/common/perfLogger.js";
import {
  buildLayoutLogParts,
  buildMutationLogParts,
  createLayoutUndoRedoHandlers,
  runShortcutSteps,
} from "@editors/common/localShortcutUtils.js";
import { attachLive2DBehavior } from "@editors/live2d/live2dBehavior.js";
import { attachLive2DTimeline } from "@editors/live2d/live2dTimeline.js";
import { attachLive2DDrag } from "@editors/live2d/live2dDrag.js";
import { attachLive2DLayoutMutationLocalRefresh } from "@editors/live2d/live2dLayoutMutationLocalRefresh.js";

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
  subsequentLayoutMode: "move",

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
      toggleSubsequentModeBtn: document.getElementById(
        "toggleSubsequentLayoutModeBtn"
      ),
      subsequentModeText: document.getElementById("subsequentLayoutModeText"),
    };

    const savedMode = storageService.load(STORAGE_KEYS.LIVE2D_SUBSEQUENT_MODE);
    if (savedMode === "hide" || savedMode === "move") {
      this.subsequentLayoutMode = savedMode;
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
    this.domCache.toggleSubsequentModeBtn?.addEventListener("click", () => this.toggleSubsequentLayoutMode());

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
        live2dEditor.renderPrimaryViewWithCharacters(() => live2dEditor.renderTimeline());
        live2dEditor.initDragAndDrop();
        live2dEditor.updateSubsequentModeButton();
        live2dEditor.bindTimelineEvents();
        live2dEditor.domCache.modal?.focus();
      },
    });
  },

  // 关闭前清理状态
  onBeforeClose() {
    this.resetTransientState({
      pendingGroupedReorderRender: null,
      pendingLayoutPropertyRender: null,
      pendingLayoutMutationRender: null,
    });
    this.resetTimelineCache?.();
  },
};

attachLayoutCardLocalRefresh(live2dEditor, {
  containerKey: "timeline",
  showToggleButton: true,
});
attachLive2DLayoutMutationLocalRefresh(live2dEditor);

attachGroupedReorderOptimization(live2dEditor, {
  debugTag: "live2dReorder",
  cardSelector: ".talk-item, .layout-item",
  containerKey: "timeline",
  // 排序失败后继续试别的局部刷新
  onBeforeFullRender: () => {
    const pendingLayout = live2dEditor.pendingLayoutPropertyRender;
    const pendingMutation = live2dEditor.pendingLayoutMutationRender;
    return runShortcutSteps(
      [
        {
          pending: pendingLayout,
          apply: () => live2dEditor.applyPendingLayoutPropertyRender(),
          onHit: () => {
            const logParts = buildLayoutLogParts(pendingLayout);
            perfLog(
              `[PERF][live2d][局部短路] 命中布局属性更新: ${logParts.join(", ")}`
            );
          },
          failReason: () =>
            `布局属性更新失败(action=${pendingLayout.actionId || "unknown"})`,
        },
        {
          pending: pendingMutation,
          apply: () => live2dEditor.applyPendingLayoutMutationRender(),
          onHit: () => {
            const logParts = buildMutationLogParts(pendingMutation);
            perfLog(
              `[PERF][live2d][局部短路] 命中布局卡片增删: ${logParts.join(", ")}`
            );
          },
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
  // 都没命中时重新渲染整页
  onFullRender: () => {
    live2dEditor.renderTimeline();
    live2dEditor.renderCharacterListForCurrentProject();
  },
});

attachEditorCore(live2dEditor, baseEditor);

attachUndoRedoLocalShortcut(live2dEditor, {
  debugTag: "live2dUndoRedo",
  ...createLayoutUndoRedoHandlers(live2dEditor),
});

attachLayoutProperties(live2dEditor);
attachCharacterList(live2dEditor);

// 把拆开的功能加回编辑器对象
attachLive2DBehavior(live2dEditor);
attachLive2DTimeline(live2dEditor);
attachLive2DDrag(live2dEditor);
