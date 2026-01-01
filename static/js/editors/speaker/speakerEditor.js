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
import { attachSpeakerDrag } from "@editors/speaker/speakerDrag.js";
import { attachSpeakerCanvas } from "@editors/speaker/speakerCanvas.js";
import { attachSpeakerState } from "@editors/speaker/speakerState.js";
import { attachSpeakerControls } from "@editors/speaker/speakerControls.js";
import { attachSpeakerPopover } from "@editors/speaker/speakerPopover.js";

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
      const usedIds = this.renderCanvas();
      this.renderCharacterList(usedIds);
      this._reattachSelection();
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
      this._toggleMultiSelectMode()
    );
    this.domCache.toggleTextEditBtn?.addEventListener("click", () =>
      this._toggleTextEditMode()
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
    const usedCharacterNames = this._getUsedCharacterIds();
    this.renderCharacterList(usedCharacterNames);
  },

  // 置顶状态变化后：刷新角色列表
  afterPinToggle() {
    const usedCharacterNames = this._getUsedCharacterIds();
    this.renderCharacterList(usedCharacterNames);
  },

  // 关闭弹窗前：取消渲染任务，并解绑选择事件
  onBeforeClose() {
    if (this.renderFrameId) {
      cancelAnimationFrame(this.renderFrameId);
      this.renderFrameId = null;
    }
    editorService.detachSelection(this.domCache.canvas);
  },
};

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
