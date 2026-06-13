// Live2D 编辑器界面视图管理
import { instantiateTemplate } from "@utils/templateLoader.js";

export const live2dEditorView = {
  editor: null,
  _instantiated: false,

  // 初始化绑定事件监听与节点缓存
  init(editor) {
    this.editor = editor;

    // 只缓存外层模态框节点
    editor.domCache = {
      modal: document.getElementById("live2dEditorModal"),
    };

    // 绑定外部打开按钮
    document.getElementById("openLive2dEditorBtn")?.addEventListener("click", () => this.editor.open());
  },

  // 确保模态框被实例化并绑定内部交互
  ensureModalInstantiated() {
    if (this._instantiated) return;

    const modal = this.editor.domCache.modal;
    instantiateTemplate("live2d-editor-template", modal);

    const editor = this.editor;

    // 缓存常用 DOM 节点
    editor.domCache = {
      ...editor.domCache,
      groupCheckbox: document.getElementById("groupCardsCheckbox"),
      timeline: document.getElementById("live2dEditorTimeline"),
      characterList: document.getElementById("live2dEditorCharacterList"),
      undoBtn: document.getElementById("live2dUndoBtn"),
      redoBtn: document.getElementById("live2dRedoBtn"),
      modeBtn: document.getElementById("toggleSubsequentLayoutModeBtn"),
      modeText: document.getElementById("subsequentLayoutModeText"),
    };

    // 绑定内部交互按钮事件
    [
      ["autoLayoutBtn", () => editor.actions.applyAutoLayout()],
      ["resetLayoutsBtn", () => editor.actions.clearAllLayouts()],
    ].forEach(([buttonId, handler]) => {
      document.getElementById(buttonId)?.addEventListener("click", handler);
    });

    // 切换后续布局模式按钮
    editor.domCache.modeBtn?.addEventListener("click", () =>
      editor.actions.toggleSubsequentMode()
    );

    // 绑定通用事件与角色置顶
    editor.initCommonEvents();
    editor.initPinButtonHandler();

    this._instantiated = true;
  },

  // 模态框获焦
  focusModal() {
    this.editor.domCache.modal?.focus();
  },
};
