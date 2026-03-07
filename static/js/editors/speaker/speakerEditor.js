import { ui } from "@utils/uiUtils.js";
import { editorService } from "@services/EditorService.js";
import { BaseEditor } from "@utils/BaseEditor.js";
import { EditorHelper } from "@utils/EditorHelper.js";
import { BaseEditorMixin } from "@mixins/BaseEditorMixin.js";
import { EventHandlerMixin } from "@mixins/EventHandlerMixin.js";
import { LayoutPropertyMixin } from "@mixins/LayoutPropertyMixin.js";
import { ScrollAnimationMixin } from "@mixins/ScrollAnimationMixin.js";
import { CharacterListMixin } from "@mixins/CharacterListMixin.js";
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
  shortValue,
  summarizeChanges,
} from "@editors/common/changeSummaryUtils.js";
import { attachSpeakerDrag } from "@editors/speaker/speakerDrag.js";
import { attachSpeakerCanvas } from "@editors/speaker/speakerCanvas.js";
import { attachSpeakerState } from "@editors/speaker/speakerState.js";
import { attachSpeakerControls } from "@editors/speaker/speakerControls.js";
import { attachSpeakerPopover } from "@editors/speaker/speakerPopover.js";
import { attachSpeakerCardLocalRefresh } from "@editors/speaker/speakerCardLocalRefresh.js";

// 创建一个通用的 BaseEditor（负责分组渲染、撤销/重做等）
const baseEditor = new BaseEditor({
  renderCallback: () => {
    speakerEditor.scheduleRender();
  },
  groupSize: 50,
});

export const speakerEditor = {
  baseEditor,
  modalId: "speakerEditorModal",
  saveButtonId: "saveSpeakersBtn",
  importButtonId: "importProjectBtn",
  exportButtonId: "exportProjectBtn",
  characterListId: "speakerEditorCharacterList",
  renderFrameId: null,

  isMultiSelectMode: false,
  isTextEditMode: false,
  domCache: {},

  // 统一的“下一帧再渲染”（避免频繁重绘导致卡顿）
  scheduleRender() {
    if (this.renderFrameId) {
      cancelAnimationFrame(this.renderFrameId);
    }
    this.renderFrameId = requestAnimationFrame(() => {
      this.renderFrameId = null;
      this.handleRenderCallback();
    });
  },

  // 初始化：缓存 DOM、绑定按钮事件、启用通用快捷键等
  init() {
    // 缓存 DOM 元素
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

    document
      .getElementById("openSpeakerEditorBtn")
      ?.addEventListener("click", () => this.open());
    document
      .getElementById("resetSpeakersBtn")
      ?.addEventListener("click", () => this.reset());
    this.domCache.toggleMultiSelectBtn?.addEventListener("click", () =>
      this.toggleMultiSelectMode()
    );
    this.domCache.toggleTextEditBtn?.addEventListener("click", () =>
      this.toggleTextEditMode()
    );

    // 初始化通用事件（撤销/重做/保存/导入导出/关闭确认/快捷键）
    this.initCommonEvents();

    // 初始化置顶按钮（图钉）
    this.initPinButtonHandler();
    this.applyModeUIState();

    if (this.domCache.modal) {
      this.domCache.modal.focus();
    }
  },

  // 打开“对话编辑器”弹窗，并加载/创建项目数据
  async open() {
    await EditorHelper.openEditor({
      editor: baseEditor,
      modalId: "speakerEditorModal",
      buttonId: "openSpeakerEditorBtn",
      loadingText: "加载中...",
      beforeOpen: async () => {
        try {
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
        this.applyModeUIState();

        const usedCharacterIds = this.renderCanvas();
        this.renderCharacterList(usedCharacterIds);
        this.initDragAndDrop();
        this.bindCanvasEvents();

        this.domCache.modal?.focus();
      },
    });
  },

  // 导入项目后：刷新画布与角色列表
  afterImport() {
    this.renderCanvas();
    const usedCharacterNames = this.getUsedCharacterIds();
    this.renderCharacterList(usedCharacterNames);
  },

  // 置顶状态变化后：刷新角色列表
  afterPinToggle() {
    const usedCharacterNames = this.getUsedCharacterIds();
    this.renderCharacterList(usedCharacterNames);
  },

  // 关闭弹窗前：取消渲染任务并清理局部状态
  onBeforeClose() {
    if (this.renderFrameId) {
      cancelAnimationFrame(this.renderFrameId);
      this.renderFrameId = null;
    }
    this.closeInlineTextEditor?.();
    // 关闭后清理局部短路标记，避免下次打开误命中旧状态。
    this.pendingGroupedReorderRender = null;
    this.pendingLayoutPropertyRender = null;
    this.pendingLayoutMutationRender = null;
    this.pendingSpeakerRender = null;
    this.pendingTextEditRender = null;
    this.pendingCardMutationRender = null;
    this.lastSpeakerRenderFailReason = "";
    this.resetCanvasRenderCache?.();
  },
};

attachSpeakerCardLocalRefresh(speakerEditor);
attachLayoutCardLocalRefresh(speakerEditor, {
  // 局部刷新目标容器（对话画布）。
  getContainer() {
    return this.domCache.canvas;
  },
  showToggleButton: false,
  // 布局卡片局部新增时复用单卡渲染函数。
  renderActionCard: speakerEditor.renderActionCard,
  // 分组头切换后复用导入后的刷新流程。
  onGroupToggle: speakerEditor.afterImport,
});

attachGroupedReorderOptimization(speakerEditor, {
  debugTag: "speakerReorder",
  cardSelector: ".dialogue-item, .layout-item",
  // 分组重排局部短路的目标容器。
  getContainer() {
    return this.domCache.canvas;
  },
  // 排序局部短路失败后，再尝试说话人/文本/增删/布局字段局部短路。
  onBeforeFullRender() {
    const pendingSpeaker = this.pendingSpeakerRender;
    const pendingText = this.pendingTextEditRender;
    const pendingMutation = this.pendingCardMutationRender;
    const pendingLayout = this.pendingLayoutPropertyRender;
    return runShortcutSteps(
      [
        {
          pending: pendingSpeaker,
          apply: () => this.applyPendingSpeakerRender(),
          onHit: () => {
            const logParts = [`actions=${pendingSpeaker.actionIds.join("|")}`];
            if (pendingSpeaker.source) {
              logParts.push(`source=${pendingSpeaker.source}`);
            }
            if (pendingSpeaker.detail) {
              logParts.push(pendingSpeaker.detail);
            }
            perfLog(
              `[PERF][speaker][局部短路] 命中说话人更新: ${logParts.join(", ")}`
            );
          },
          failReason: () =>
            `说话人更新失败(actions=${pendingSpeaker.actionIds.join("|") || "none"}${
              this.lastSpeakerRenderFailReason
                ? `, reason=${this.lastSpeakerRenderFailReason}`
                : ""
            })`,
        },
        {
          pending: pendingText,
          apply: () => this.applyPendingTextEditRender(),
          onHit: () => {
            const textDetail =
              pendingText.detail ||
              `text: "${shortValue(pendingText.oldText, 72)}" -> "${shortValue(
                pendingText.text,
                72
              )}"`;
            const logParts = [`action=${pendingText.actionId || "unknown"}`];
            if (pendingText.source) {
              logParts.push(`source=${pendingText.source}`);
            }
            logParts.push(textDetail);
            perfLog(
              `[PERF][speaker][局部短路] 命中文本更新: ${logParts.join(", ")}`
            );
          },
          failReason: () =>
            `文本更新失败(action=${pendingText.actionId || "unknown"})`,
        },
        {
          pending: pendingMutation,
          apply: () => this.applyPendingCardMutationRender(),
          onHit: () => {
            const logParts = [
              `type=${pendingMutation.type || "unknown"}`,
              `action=${pendingMutation.actionId || "unknown"}`,
            ];
            if (pendingMutation.source) {
              logParts.push(`source=${pendingMutation.source}`);
            }
            if (pendingMutation.detail) {
              logParts.push(pendingMutation.detail);
            }
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
          apply: () => this.applyPendingLayoutPropertyRender(),
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
  // 命中局部短路后，补一次选择态绑定。
  onLocalRenderSuccess() {
    this.reattachSelection();
  },
  // 所有局部短路都未命中时，执行全量重绘。
  onFullRender() {
    const usedIds = this.renderCanvas();
    this.renderCharacterList(usedIds);
    this.reattachSelection();
  },
});

attachUndoRedoLocalShortcut(baseEditor, {
  debugTag: "speakerUndoRedo",
  // 撤销/恢复导致新增卡片时，标记卡片增删局部短路。
  onActionAdded({ actionAfter, summary, phase }) {
    speakerEditor.pendingCardMutationRender = {
      type: "add",
      actionId: actionAfter.id,
      source: phase,
      detail: summary,
    };
  },
  // 撤销/恢复导致删除卡片时，标记卡片增删局部短路。
  onActionRemoved({ actionBefore, indexBefore, summary, phase }) {
    speakerEditor.pendingCardMutationRender = {
      type: "delete",
      actionId: actionBefore.id,
      startIndex: indexBefore,
      source: phase,
      detail: summary,
    };
  },
  // 撤销/恢复触发排序变化时，标记排序局部短路。
  onActionOrderChanged({ phase, orderSummary }) {
    speakerEditor.markGroupedReorderRender("state", phase, orderSummary);
  },
  // 撤销/恢复触发文本变化时，标记文本局部短路。
  onTextChanged({ actionId, actionBefore, actionAfter, changes, phase }) {
    speakerEditor.pendingTextEditRender = {
      actionId,
      text: actionAfter?.text || "",
      oldText: actionBefore?.text || "",
      source: phase,
      detail: summarizeChanges(changes, 72),
    };
  },
  // 撤销/恢复触发说话人字段变化时，标记说话人局部短路。
  onSpeakerFieldChanged({ actionId, actionIds, changes, phase }) {
    const targetActionIds =
      Array.isArray(actionIds) && actionIds.length > 0
        ? actionIds
        : [actionId];
    speakerEditor.markSpeakerRender(
      targetActionIds,
      phase,
      `changes=${summarizeChanges(changes, 72) || "none"}`
    );
  },
  // 撤销/恢复触发布局字段变化时，标记布局属性局部短路。
  onLayoutFieldChanged({ actionId, changes, phase }) {
    speakerEditor.markLayoutPropertyRender(actionId, {
      source: phase,
      changes,
    });
  },
});

// 状态桥接：让 speakerEditor 直接拥有 projectFileState 等字段
applyStateBridge(speakerEditor, baseEditor);

// 混入通用能力（保存/事件/布局控件/滚动/角色列表等）
Object.assign(
  speakerEditor,
  BaseEditorMixin,
  EventHandlerMixin,
  LayoutPropertyMixin,
  ScrollAnimationMixin,
  CharacterListMixin
);

// 注入拆分出的功能模块（把 speakerEditor 作为宿主对象扩展方法）
attachSpeakerState(speakerEditor);
attachSpeakerControls(speakerEditor);
attachSpeakerCanvas(speakerEditor);
attachSpeakerDrag(speakerEditor, baseEditor);
attachSpeakerPopover(speakerEditor);
