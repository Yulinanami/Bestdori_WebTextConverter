// 对话编辑器的入口
import { BaseEditor } from "@utils/BaseEditor.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { attachCharacterList } from "@editors/common/characterList.js";
import { attachEditorCore, rerenderOnGroupToggle } from "@editors/common/editorCore.js";
import { attachLayoutUI } from "@editors/common/layoutProperties.js";
import { attachGroupReorder } from "@editors/common/groupedReorder.js";
import { attachLayoutRefresh } from "@editors/common/layoutRefresh.js";
import { attachUndoRedo } from "@editors/common/undoRedo.js";
import { perfLog } from "@editors/common/perfLogger.js";
import { layoutLog, mutationLog, speakerLog, textLog, speakerUndoHooks, runShortcutSteps } from "@editors/common/localShortcutUtils.js";
import { attachSpeakerDrag } from "@editors/speaker/speakerDrag.js";
import { attachSpeakerCanvas } from "@editors/speaker/speakerCanvas.js";
import { attachSpeakerActions } from "@editors/speaker/speakerBehavior.js";
import { attachSpeakerRefresh, renderSpeakerCard } from "@editors/speaker/speakerRefresh.js";

// 创建对话编辑器用的基础对象
const baseEditor = new BaseEditor({
  // 需要重新渲染时都走这一层
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
      optimizeDragCheckbox: document.getElementById("optimizeDragCheckbox"),
      canvas: document.getElementById("speakerEditorCanvas"),
      characterList: document.getElementById("speakerEditorCharacterList"),
      modal: document.getElementById("speakerEditorModal"),
      undoBtn: document.getElementById("undoBtn"),
      redoBtn: document.getElementById("redoBtn"),
      multiSelectBtn: document.getElementById("toggleMultiSelectBtn"),
      textEditBtn: document.getElementById("toggleTextEditBtn"),
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
    this.domCache.multiSelectBtn?.addEventListener("click", () => this.toggleMultiSelect());
    // 切换卡片排序模式
    this.domCache.textEditBtn?.addEventListener("click", () => this.toggleSortMode());

    // 绑定通用事件
    this.initCommonEvents();

    if (this.domCache.optimizeDragCheckbox) {
      this.domCache.optimizeDragCheckbox.checked = this.isDragOptimized;
      this.domCache.optimizeDragCheckbox.addEventListener("change", (e) => {
        this.isDragOptimized = e.target.checked;
        storageService.save(
          STORAGE_KEYS.SPEAKER_DRAG_OPTIMIZATION,
          this.isDragOptimized
        );
        this.applyModeUIState();
        this.initDragAndDrop();
      });
    }

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
        speakerEditor.renderViewAndList(() => speakerEditor.renderCanvas());
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
    this.closeInlineEditor?.();
    // 清空这次编辑留下的临时标记
    this.resetLayoutTransientState({
      pendingSpeakerChange: null,
      pendingTextChange: null,
      pendingCardMutation: null,
      lastSpeakerError: "",
    });
    this.resetCanvasRenderCache?.();
  },
};

attachSpeakerRefresh(speakerEditor);
attachLayoutRefresh(speakerEditor, {
  containerKey: "canvas",
  // 对话编辑器的布局卡也要支持右上角自定义位置按钮
  showToggleButton: true,
  // 新增布局卡片时直接渲染一张
  renderActionCard: renderSpeakerCard,
  // 切换分组后重新渲染当前内容
  onGroupToggle: (groupIndex, isOpening) =>
    rerenderOnGroupToggle(speakerEditor, groupIndex, isOpening, {
      renderView: () => speakerEditor.renderViewAndList(() => speakerEditor.renderCanvas()),
      containerKey: "canvas",
      shouldScrollOnOpen: false,
    }),
});

attachGroupReorder(speakerEditor, {
  debugTag: "speakerReorder",
  cardSelector: ".dialogue-item, .layout-item",
  containerKey: "canvas",
  // 排序失败后继续试别的局部刷新
  onBeforeFullRender: () => {
    const pendingSpeaker = speakerEditor.pendingSpeakerChange;
    const pendingText = speakerEditor.pendingTextChange;
    const pendingMutation = speakerEditor.pendingCardMutation;
    const pendingLayout = speakerEditor.pendingLayoutChange;
    return runShortcutSteps(
      [
        {
          pending: pendingSpeaker,
          // 尝试只刷新说话人显示
          apply: () => speakerEditor.applySpeakerChange(),
          // 命中后记录说话人日志
          onHit: () => {
            const logParts = speakerLog(pendingSpeaker);
            perfLog(
              `[PERF][speaker][局部短路] 命中说话人更新: ${logParts.join(", ")}`
            );
          },
          // 生成说话人失败原因
          failReason: () =>
            `说话人更新失败(actions=${pendingSpeaker.actionIds.join("|") || "none"}${
              speakerEditor.lastSpeakerError
                ? `, reason=${speakerEditor.lastSpeakerError}`
                : ""
            })`,
        },
        {
          pending: pendingText,
          // 尝试只刷新文本
          apply: () => speakerEditor.applyTextChange(),
          // 命中后记录文本日志
          onHit: () => {
            const logParts = textLog(pendingText, 72);
            perfLog(
              `[PERF][speaker][局部短路] 命中文本更新: ${logParts.join(", ")}`
            );
          },
          // 生成文本失败原因
          failReason: () =>
            `文本更新失败(action=${pendingText.actionId || "unknown"})`,
        },
        {
          pending: pendingMutation,
          // 尝试只刷新卡片增删
          apply: () => speakerEditor.applyCardMutation(),
          // 命中后记录卡片增删日志
          onHit: () => {
            const logParts = mutationLog(pendingMutation);
            perfLog(
              `[PERF][speaker][局部短路] 命中卡片增删: ${logParts.join(", ")}`
            );
          },
          // 生成卡片增删失败原因
          failReason: () =>
            `卡片增删失败(type=${pendingMutation.type || "unknown"}, action=${
              pendingMutation.actionId || "unknown"
            })`,
        },
        {
          pending: pendingLayout,
          // 尝试只刷新布局字段
          apply: () => speakerEditor.applyLayoutChange(),
          // 命中后记录布局字段日志
          onHit: () => {
            const logParts = layoutLog(pendingLayout, 72);
            perfLog(
              `[PERF][speaker][局部短路] 命中布局属性更新: ${logParts.join(", ")}`
            );
          },
          // 生成布局字段失败原因
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
  // 都没命中时重画整个编辑器
  onFullRender: () => {
    const usedIds = speakerEditor.renderCanvas();
    speakerEditor.renderCharacterList(usedIds);
    speakerEditor.reattachSelection();
  },
});

attachEditorCore(speakerEditor, baseEditor);

attachUndoRedo(speakerEditor, {
  debugTag: "speakerUndoRedo",
  ...speakerUndoHooks(speakerEditor, 72),
});

attachLayoutUI(speakerEditor);
attachCharacterList(speakerEditor);

// 把拆开的功能加回编辑器对象
attachSpeakerActions(speakerEditor);
attachSpeakerCanvas(speakerEditor);
attachSpeakerDrag(speakerEditor);
