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

// 创建基础编辑器实例
const baseEditor = new BaseEditor({
  renderCallback: () => {
    const usedIds = speakerEditor.renderCanvas();
    speakerEditor.renderCharacterList(usedIds);
    speakerEditor._reattachSelection();
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

  isMultiSelectMode: false,
  isTextEditMode: false,
  domCache: {},

  // 初始化编辑器，绑定事件监听器和快捷键
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

    // 初始化通用事件
    this.initCommonEvents();

    // 初始化置顶按钮处理
    this.initPinButtonHandler();
    this.applyModeUIState();

    if (this.domCache.modal) {
      this.domCache.modal.focus();
    }
  },

  // 打开对话编辑器模态框
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

  // 钩子方法
  afterImport() {
    this.renderCanvas();
    const usedCharacterNames = this._getUsedCharacterIds();
    this.renderCharacterList(usedCharacterNames);
  },

  afterPinToggle() {
    const usedCharacterNames = this._getUsedCharacterIds();
    this.renderCharacterList(usedCharacterNames);
  },

  onBeforeClose() {
    editorService.detachSelection(this.domCache.canvas);
  },
};

// 状态代理
applyStateBridge(speakerEditor, baseEditor);

// 使用 Object.assign 继承 mixins
Object.assign(
  speakerEditor,
  BaseEditorMixin,
  EventHandlerMixin,
  LayoutPropertyMixin,
  ScrollAnimationMixin,
  CharacterListMixin
);

// 拆分模块注入
attachSpeakerState(speakerEditor);
attachSpeakerControls(speakerEditor);
attachSpeakerCanvas(speakerEditor);
attachSpeakerDrag(speakerEditor, baseEditor);
attachSpeakerPopover(speakerEditor);
