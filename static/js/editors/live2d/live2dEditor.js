// 管理 layout action（登场/移动/退场）并提供拖拽编辑
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

// 创建一个通用的 BaseEditor（负责分组渲染、撤销/重做等）
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

  // 初始化：缓存 DOM、绑定按钮事件、读取本地偏好设置
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

    // 初始化通用事件（撤销/重做/保存/导入导出/关闭确认/快捷键）
    this.initCommonEvents();

    // 初始化置顶按钮（图钉）
    this.initPinButtonHandler();
  },

  // 打开 Live2D 布局编辑器弹窗，并加载/创建项目数据
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

  // 导入项目后：刷新时间线与角色列表
  afterImport() {
    this.renderTimeline();
    const usedCharacterNames = this._getUsedCharacterIds();
    this.renderCharacterList(usedCharacterNames);
  },

  // 置顶状态变化后：刷新角色列表
  afterPinToggle() {
    const usedCharacterNames = this._getUsedCharacterIds();
    this.renderCharacterList(usedCharacterNames);
  },
};

// 状态桥接：让 live2dEditor 直接拥有 projectFileState 等字段
applyStateBridge(live2dEditor, baseEditor);

// 混入通用能力（保存/事件/布局控件/滚动/角色列表等）
Object.assign(
  live2dEditor,
  BaseEditorMixin,
  EventHandlerMixin,
  LayoutPropertyMixin,
  ScrollAnimationMixin,
  CharacterListMixin
);

// 注入拆分出的功能模块（把 live2dEditor 作为宿主对象扩展方法）
attachLive2dState(live2dEditor, baseEditor);
attachLive2dControls(live2dEditor);
attachLive2dTimeline(live2dEditor);
attachLive2dDrag(live2dEditor, baseEditor);
