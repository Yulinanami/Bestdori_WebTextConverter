// 对话编辑器界面视图管理
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { instantiateTemplate } from "@utils/templateLoader.js";

export const speakerEditorView = {
  editor: null,
  _instantiated: false,

  // 初始化绑定事件监听与节点缓存
  init(editor) {
    this.editor = editor;

    // 只缓存外层模态框节点，此时内部为空
    editor.domCache = {
      modal: document.getElementById("speakerEditorModal"),
    };

    // 绑定外部打开按钮
    document.getElementById("openSpeakerEditorBtn")?.addEventListener("click", () => this.editor.open());
  },

  // 确保模态框被实例化并绑定内部交互
  ensureModalInstantiated() {
    if (this._instantiated) return;

    const modal = this.editor.domCache.modal;
    instantiateTemplate("speaker-editor-template", modal);

    const editor = this.editor;

    // 缓存常用 DOM 节点
    editor.domCache = {
      ...editor.domCache,
      groupCheckbox: document.getElementById("groupCardsCheckbox"),
      optimizeDragCheckbox: document.getElementById("optimizeDragCheckbox"),
      canvas: document.getElementById("speakerEditorCanvas"),
      characterList: document.getElementById("speakerEditorCharacterList"),
      undoBtn: document.getElementById("undoBtn"),
      redoBtn: document.getElementById("redoBtn"),
      multiSelectBtn: document.getElementById("toggleMultiSelectBtn"),
      textEditBtn: document.getElementById("toggleTextEditBtn"),
    };

    // 绑定内部重置按钮事件
    document.getElementById("resetSpeakersBtn")?.addEventListener("click", () => editor.actions.reset());

    // 绑定多选和排序选项按钮
    editor.domCache.multiSelectBtn?.addEventListener("click", () =>
      editor.actions.toggleMultiSelect()
    );
    editor.domCache.textEditBtn?.addEventListener("click", () =>
      editor.actions.toggleSortMode()
    );

    // 绑定拖拽优化复选框
    if (editor.domCache.optimizeDragCheckbox) {
      editor.domCache.optimizeDragCheckbox.checked = editor.actions.isDragOptimized;
      editor.domCache.optimizeDragCheckbox.addEventListener("change", (changeEvent) => {
        editor.actions.isDragOptimized = changeEvent.target.checked;
        storageService.save(
          STORAGE_KEYS.SPEAKER_DRAG_OPTIMIZATION,
          editor.actions.isDragOptimized
        );
        editor.actions.applyModeUIState();
        editor.initDragAndDrop();
      });
    }

    // 绑定底座通用事件及角色置顶
    editor.initCommonEvents();
    editor.initPinButtonHandler();
    editor.actions.applyModeUIState();

    this._instantiated = true;
  },

  // 模态框获焦
  focusModal() {
    this.editor.domCache.modal?.focus();
  },
};

