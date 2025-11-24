// live2d布局编辑器
import { BaseEditor } from "@utils/BaseEditor.js";
import { EditorHelper } from "@utils/EditorHelper.js";
import { ui } from "@utils/uiUtils.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { BaseEditorMixin } from "@mixins/BaseEditorMixin.js";
import { EventHandlerMixin } from "@mixins/EventHandlerMixin.js";
import { LayoutPropertyMixin } from "@mixins/LayoutPropertyMixin.js";
import { ScrollAnimationMixin } from "@mixins/ScrollAnimationMixin.js";
import { CharacterListMixin } from "@mixins/CharacterListMixin.js";
import { applyStateBridge } from "@editors/common/stateBridge.js";
import { attachLive2dState } from "@editors/live2d/live2dState.js";
import { attachLive2dControls } from "@editors/live2d/live2dControls.js";
import { attachLive2dTimeline } from "@editors/live2d/live2dTimeline.js";
import { attachLive2dDrag } from "@editors/live2d/live2dDrag.js";

// 创建基础编辑器实例
const baseEditor = new BaseEditor({
  renderCallback: () => {
    live2dEditor.renderTimeline();
    const usedNames = live2dEditor._getUsedCharacterIds();
    live2dEditor.renderCharacterList(usedNames);
  },
  groupSize: 50,
});

export const live2dEditor = {
  baseEditor,
  modalId: "live2dEditorModal",
  saveButtonId: "saveLayoutsBtn",
  importButtonId: "importLayoutsBtn",
  exportButtonId: "exportLayoutsBtn",
  characterListId: "live2dEditorCharacterList",

  // DOM 缓存
  domCache: {},
  // 后续布局模式: 'move' 或 'hide'
  subsequentLayoutMode: "move",

  // 初始化编辑器，绑定事件监听器和快捷键
  init() {
    // 缓存 DOM 元素
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

    const savedMode = storageService.get(STORAGE_KEYS.LIVE2D_SUBSEQUENT_MODE);
    if (savedMode === "hide" || savedMode === "move") {
      this.subsequentLayoutMode = savedMode;
    }

    document
      .getElementById("openLive2dEditorBtn")
      ?.addEventListener("click", () => this.open());
    document
      .getElementById("autoLayoutBtn")
      ?.addEventListener("click", () => this._applyAutoLayout());
    document
      .getElementById("resetLayoutsBtn")
      ?.addEventListener("click", () => this._clearAllLayouts());
    this.domCache.toggleSubsequentModeBtn?.addEventListener("click", () =>
      this._toggleSubsequentLayoutMode()
    );

    // 初始化通用事件
    this.initCommonEvents();

    // 初始化置顶按钮处理
    this.initPinButtonHandler();
  },

  // 打开 Live2D 布局编辑器模态框
  async open() {
    await EditorHelper.openEditor({
      editor: baseEditor,
      modalId: "live2dEditorModal",
      buttonId: "openLive2dEditorBtn",
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
        this.renderTimeline();
        const usedCharacterNames = this._getUsedCharacterIds();
        this.renderCharacterList(usedCharacterNames);
        this.initDragAndDrop();
        this._updateSubsequentModeButton();
        this.bindTimelineEvents();

        if (this.domCache.modal) this.domCache.modal.focus();
      },
    });
  },

  // 钩子方法：导入后刷新视图
  afterImport() {
    this.renderTimeline();
    const usedCharacterNames = this._getUsedCharacterIds();
    this.renderCharacterList(usedCharacterNames);
  },

  // 钩子方法：置顶切换后刷新角色列表
  afterPinToggle() {
    const usedCharacterNames = this._getUsedCharacterIds();
    this.renderCharacterList(usedCharacterNames);
  },
};

// 状态代理
applyStateBridge(live2dEditor, baseEditor);

// 继承 mixins
Object.assign(
  live2dEditor,
  BaseEditorMixin,
  EventHandlerMixin,
  LayoutPropertyMixin,
  ScrollAnimationMixin,
  CharacterListMixin
);

// 注入拆分后的功能模块
attachLive2dState(live2dEditor, baseEditor);
attachLive2dControls(live2dEditor);
attachLive2dTimeline(live2dEditor);
attachLive2dDrag(live2dEditor, baseEditor);
