// 动作表情编辑器界面视图管理
import { instantiateTemplate } from "@utils/templateLoader.js";

export const expressionEditorView = {
  editor: null,
  _instantiated: false,

  // 初始化绑定事件监听与节点缓存
  init(editor) {
    this.editor = editor;

    // 只缓存外层模态框节点
    editor.domCache = {
      modal: document.getElementById("expressionEditorModal"),
    };

    // 绑定外部打开按钮
    document.getElementById("openExpressionEditorBtn")?.addEventListener("click", () => this.editor.open());
  },

  // 确保模态框被实例化并绑定内部交互
  ensureModalInstantiated() {
    if (this._instantiated) return;

    const modal = this.editor.domCache.modal;
    instantiateTemplate("expression-editor-template", modal);

    const editor = this.editor;

    // 缓存常用 DOM 节点
    editor.domCache = {
      ...editor.domCache,
      groupCheckbox: document.getElementById("groupCardsCheckbox"),
      timeline: document.getElementById("expressionEditorTimeline"),
      undoBtn: document.getElementById("expressionUndoBtn"),
      redoBtn: document.getElementById("expressionRedoBtn"),
      motionList: document.getElementById("motionLibraryList"),
      expressionList: document.getElementById("expressionLibraryList"),
    };

    // 绑定内部动作按钮事件
    [
      ["resetExpressionsBtn", () => editor.reset()],
      ["addTempMotionBtn", () => editor.actions.addTempItem("motion")],
      ["addTempExpressionBtn", () => editor.actions.addTempItem("expression")],
      ["live2dViewerBtn", () => editor.actions.openLive2DViewers()],
    ].forEach(([buttonId, handler]) => {
      document.getElementById(buttonId)?.addEventListener("click", handler);
    });

    // 绑定检索框过滤逻辑
    this.setupSearchInput("motion", "motionSearchInput", "clearMotionSearchBtn");
    this.setupSearchInput("expression", "expressionSearchInput", "clearExpressionSearchBtn");

    // 绑定资源库代理点击事件
    this.setupLibraryClickEvents();

    // 绑定通用事件
    editor.initCommonEvents();

    this._instantiated = true;
  },

  // 辅助方法：设置搜索框输入和清空
  setupSearchInput(type, inputId, clearBtnId) {
    const searchInput = document.getElementById(inputId);
    const clearButton = document.getElementById(clearBtnId);
    if (!searchInput || !clearButton) return;

    searchInput.addEventListener("input", () => {
      clearButton.style.display = searchInput.value ? "block" : "none";
      this.editor.actions.filterLibraryList(type, { target: searchInput });
    });

    clearButton.addEventListener("click", () => {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.focus();
    });
  },

  // 辅助方法：设置资源库快速填充的事件委托
  setupLibraryClickEvents() {
    const libraryContainer = document.getElementById("expressionEditorLibrary");
    if (!libraryContainer) return;

    libraryContainer.addEventListener("click", (clickEvent) => {
      const quickFillButton = clickEvent.target.closest(".quick-fill-btn");
      const quickFillItem = clickEvent.target.closest(".quick-fill-item");
      const deleteButton = clickEvent.target.closest(".quick-fill-delete-btn");

      if (deleteButton) {
        clickEvent.stopPropagation();
        this.editor.actions.removeQuickFill(deleteButton.dataset.value);
        return;
      }

      if (quickFillButton) {
        this.editor.actions.toggleQuickFill(quickFillButton.dataset.type);
      }

      if (quickFillItem) {
        clickEvent.preventDefault();
        const type = quickFillItem.dataset.type;
        const selectedValue = quickFillItem.dataset.value;
        if (type === "add-custom") {
          this.editor.actions.addQuickFillOption();
        } else {
          this.editor.actions.applyQuickFill(type, selectedValue);
        }
      }
    });
  },

  // 清空两个搜索输入框
  clearSearchInputs() {
    const motionSearch = document.getElementById("motionSearchInput");
    const expressionSearch = document.getElementById("expressionSearchInput");
    const clearMotionBtn = document.getElementById("clearMotionSearchBtn");
    const clearExpressionBtn = document.getElementById("clearExpressionSearchBtn");

    if (motionSearch) motionSearch.value = "";
    if (expressionSearch) expressionSearch.value = "";
    if (clearMotionBtn) clearMotionBtn.style.display = "none";
    if (clearExpressionBtn) clearExpressionBtn.style.display = "none";
  },

  // 模态框获焦
  focusModal() {
    this.editor.domCache.modal?.focus();
  },
};
