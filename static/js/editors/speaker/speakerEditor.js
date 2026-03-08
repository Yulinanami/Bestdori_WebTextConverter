// 对话编辑器的入口
import { BaseEditor } from "@utils/BaseEditor.js";
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
  buildSpeakerLogParts,
  buildTextUpdateLogParts,
  createSpeakerUndoRedoHandlers,
  runShortcutSteps,
} from "@editors/common/localShortcutUtils.js";
import { attachSpeakerDrag } from "@editors/speaker/speakerDrag.js";
import { attachSpeakerCanvas } from "@editors/speaker/speakerCanvas.js";
import { attachSpeakerBehavior } from "@editors/speaker/speakerBehavior.js";
import {
  attachSpeakerCardLocalRefresh,
  renderSpeakerActionCard,
} from "@editors/speaker/speakerCardLocalRefresh.js";

// 创建对话编辑器用的基础对象
const baseEditor = new BaseEditor({
// 需要重新渲染时走同一个调度
  renderCallback: () => {
    speakerEditor.scheduleRender();
  },
  groupSize: 50,
});

export const speakerEditor = {
  modalId: "speakerEditorModal",
  openButtonId: "openSpeakerEditorBtn",
  saveButtonId: "saveSpeakersBtn",
  importButtonId: "importProjectBtn",
  exportButtonId: "exportProjectBtn",
  characterListId: "speakerEditorCharacterList",
  renderFrameId: null,

  isMultiSelectMode: false,
  isTextEditMode: false,
  domCache: {},

  // 下一帧再刷新
  scheduleRender() {
    if (this.renderFrameId) {
      cancelAnimationFrame(this.renderFrameId);
    }
    // 下一帧再执行刷新
    this.renderFrameId = requestAnimationFrame(() => {
      this.renderFrameId = null;
      this.handleRenderCallback();
    });
  },

  // 初始化编辑器
  init() {
    // 先缓存常用节点
    this.domCache = {
      groupCheckbox: document.getElementById("groupCardsCheckbox"),
      canvas: document.getElementById("speakerEditorCanvas"),
      characterList: document.getElementById("speakerEditorCharacterList"),
      modal: document.getElementById("speakerEditorModal"),
      undoBtn: document.getElementById("undoBtn"),
      redoBtn: document.getElementById("redoBtn"),
      toggleMultiSelectBtn: document.getElementById("toggleMultiSelectBtn"),
      toggleTextEditBtn: document.getElementById("toggleTextEditBtn"),
    };

    this.loadModePreferences();

    [
      ["openSpeakerEditorBtn", () => this.open()],
      ["resetSpeakersBtn", () => this.reset()],
      // 给按钮绑定对应方法
    ].forEach(([buttonId, handler]) => {
      document.getElementById(buttonId)?.addEventListener("click", handler);
    });
    // 切换多选模式
    this.domCache.toggleMultiSelectBtn?.addEventListener("click", () => this.toggleMultiSelectMode());
    // 切换文本编辑模式
    this.domCache.toggleTextEditBtn?.addEventListener("click", () => this.toggleTextEditMode());

    // 绑定通用事件
    this.initCommonEvents();

    // 绑定置顶角色按钮
    this.initPinButtonHandler();
    this.applyModeUIState();
    this.domCache.modal?.focus();
  },

  // 打开对话编辑器
  async open() {
    await this.openProjectEditor({
      // 打开后刷新画布和拖拽
      afterOpen: async () => {
        speakerEditor.applyModeUIState();
        speakerEditor.renderPrimaryViewWithCharacters(() => speakerEditor.renderCanvas());
        speakerEditor.initDragAndDrop();
        speakerEditor.bindCanvasEvents();
        speakerEditor.domCache.modal?.focus();
      },
    });
  },

  // 关闭前清理状态
  onBeforeClose() {
    if (this.renderFrameId) {
      cancelAnimationFrame(this.renderFrameId);
      this.renderFrameId = null;
    }
    this.closeInlineTextEditor?.();
    // 清空这次编辑留下的临时标记
    this.resetTransientState({
      pendingGroupedReorderRender: null,
      pendingLayoutPropertyRender: null,
      pendingLayoutMutationRender: null,
      pendingSpeakerRender: null,
      pendingTextEditRender: null,
      pendingCardMutationRender: null,
      lastSpeakerRenderFailReason: "",
    });
    this.resetCanvasRenderCache?.();
  },
};

attachSpeakerCardLocalRefresh(speakerEditor);
attachLayoutCardLocalRefresh(speakerEditor, {
  containerKey: "canvas",
  showToggleButton: false,
// 新增布局卡片时直接渲染一张
  renderActionCard: renderSpeakerActionCard,
  // 切换分组后重新渲染当前内容
  onGroupToggle: () =>
    speakerEditor.renderPrimaryViewWithCharacters(() => speakerEditor.renderCanvas()),
});

attachGroupedReorderOptimization(speakerEditor, {
  debugTag: "speakerReorder",
  cardSelector: ".dialogue-item, .layout-item",
  containerKey: "canvas",
  // 排序失败后继续试别的局部刷新
  onBeforeFullRender: () => {
    const pendingSpeaker = speakerEditor.pendingSpeakerRender;
    const pendingText = speakerEditor.pendingTextEditRender;
    const pendingMutation = speakerEditor.pendingCardMutationRender;
    const pendingLayout = speakerEditor.pendingLayoutPropertyRender;
    return runShortcutSteps(
      [
        {
          pending: pendingSpeaker,
          apply: () => speakerEditor.applyPendingSpeakerRender(),
          onHit: () => {
            const logParts = buildSpeakerLogParts(pendingSpeaker);
            perfLog(
              `[PERF][speaker][局部短路] 命中说话人更新: ${logParts.join(", ")}`
            );
          },
          failReason: () =>
            `说话人更新失败(actions=${pendingSpeaker.actionIds.join("|") || "none"}${
              speakerEditor.lastSpeakerRenderFailReason
                ? `, reason=${speakerEditor.lastSpeakerRenderFailReason}`
                : ""
            })`,
        },
        {
          pending: pendingText,
          apply: () => speakerEditor.applyPendingTextEditRender(),
          onHit: () => {
            const logParts = buildTextUpdateLogParts(pendingText, 72);
            perfLog(
              `[PERF][speaker][局部短路] 命中文本更新: ${logParts.join(", ")}`
            );
          },
          failReason: () =>
            `文本更新失败(action=${pendingText.actionId || "unknown"})`,
        },
        {
          pending: pendingMutation,
          apply: () => speakerEditor.applyPendingCardMutationRender(),
          onHit: () => {
            const logParts = buildMutationLogParts(pendingMutation);
            perfLog(
              `[PERF][speaker][局部短路] 命中卡片增删: ${logParts.join(", ")}`
            );
          },
          failReason: () =>
            `卡片增删失败(type=${pendingMutation.type || "unknown"}, action=${
              pendingMutation.actionId || "unknown"
            })`,
        },
        {
          pending: pendingLayout,
          apply: () => speakerEditor.applyPendingLayoutPropertyRender(),
          onHit: () => {
            const logParts = buildLayoutLogParts(pendingLayout, 72);
            perfLog(
              `[PERF][speaker][局部短路] 命中布局属性更新: ${logParts.join(", ")}`
            );
          },
          failReason: () =>
            `布局属性更新失败(action=${pendingLayout.actionId || "unknown"})`,
        },
      ],
      (failedReasons) => {
        perfLog(
          `[PERF][speaker][局部短路] 回退全量渲染: 原因=${failedReasons.join("; ")}`
        );
      }
    );
  },
  // 局部刷新成功后补一次选中状态
  onLocalRenderSuccess: () => speakerEditor.reattachSelection(),
  // 都没命中时重新渲染整页
  onFullRender: () => {
    const usedIds = speakerEditor.renderCanvas();
    speakerEditor.renderCharacterList(usedIds);
    speakerEditor.reattachSelection();
  },
});

attachEditorCore(speakerEditor, baseEditor);

attachUndoRedoLocalShortcut(speakerEditor, {
  debugTag: "speakerUndoRedo",
  ...createSpeakerUndoRedoHandlers(speakerEditor, 72),
});

attachLayoutProperties(speakerEditor);
attachCharacterList(speakerEditor);

// 把拆开的功能加回编辑器对象
attachSpeakerBehavior(speakerEditor);
attachSpeakerCanvas(speakerEditor);
attachSpeakerDrag(speakerEditor);
