// 三个编辑器共用的方法
import { DataUtils } from "@utils/DataUtils.js";
import { createCache, renderFast, clearCache } from "@utils/timelineRender.js";
import { EditorHelper } from "@utils/EditorHelper.js";
import { BaseEditor } from "@utils/BaseEditor.js";
import { buildProjectData } from "@utils/ConverterCore.js";
import { ui } from "@utils/uiUtils.js";
import { scrollToGroupHeader } from "@editors/common/groupHeaderUtils.js";
import { state } from "@managers/stateManager.js";
import { historyManager } from "@managers/historyManager.js";
import { projectManager } from "@managers/projectManager.js";

const editorCoreMethods = {
  sortableInstances: [],
  scrollAnimationFrame: null,
  scrollSpeed: 0,

  // 按 id 读取一条动作
  findActionById(actionId, actions = this.projectFileState?.actions || []) {
    return actions.find((actionItem) => actionItem.id === actionId);
  },

  // 按 id 找到动作下标
  findActionIndexById(
    actionId,
    actions = this.projectFileState?.actions || [],
  ) {
    return actions.findIndex((actionItem) => actionItem.id === actionId);
  },

  // 只修改命中的一条动作
  executeActionChange(actionId, mutate) {
    this.executeCommand((currentState) => {
      const action = this.findActionById(actionId, currentState.actions);
      if (action) {
        mutate(action, currentState);
      }
    });
  },

  // 刷新当前项目用到的角色列表
  renderUsedList() {
    if (
      typeof this.renderCharacterList === "function" &&
      typeof this.listUsedIds === "function"
    ) {
      this.renderCharacterList(this.listUsedIds());
    }
  },

  // 先渲染主区域 再渲染角色列表
  renderViewAndList(renderView) {
    const usedCharacterIds = renderView.call(this);
    if (typeof this.renderCharacterList === "function") {
      this.renderCharacterList(usedCharacterIds ?? this.listUsedIds?.());
    }
  },

  // 重置临时状态
  resetTransientState(nextState) {
    Object.entries(nextState).forEach(([key, value]) => {
      this[key] = typeof value === "function" ? value() : value;
    });
  },

  // 重置布局相关的局部刷新标记，其它编辑器状态按需追加
  resetLayoutTransientState(extraState = {}) {
    this.resetTransientState({
      pendingGroupReorder: null,
      pendingLayoutChange: null,
      pendingLayoutPatch: null,
      ...extraState,
    });
  },

  // 保存编辑器内容
  async save() {
    await EditorHelper.saveEditor({
      editor: this,
      modalId: this.modalId,
      buttonId: this.saveButtonId,
      // 保存时把最新状态写回项目数据
      applyChanges: () => {
        projectManager.save(this.projectFileState, (savedState) => {
          this.originalStateOnOpen = JSON.stringify(savedState);
        });
      },
    });
  },

  // 导入一个项目文件
  async importProject() {
    const importedProject = await projectManager.import();
    if (!importedProject) {
      return;
    }

    // 导入后把内容放进当前编辑器
    this.projectFileState = importedProject;
    this.originalStateOnOpen = JSON.stringify(importedProject);
    state.projectFile = DataUtils.deepClone(importedProject);
    historyManager.clear();

    // 有自定义导入后处理就优先走它
    if (typeof this.afterImport === "function") {
      this.afterImport();
      return;
    }

    // 不同编辑器主区域不一样 按已挂好的渲染方法选入口
    if (
      typeof this.renderViewAndList === "function" &&
      typeof this.renderCanvas === "function"
    ) {
      this.renderViewAndList(() => this.renderCanvas());
      return;
    }

    if (
      typeof this.renderViewAndList === "function" &&
      typeof this.renderTimeline === "function"
    ) {
      this.renderViewAndList(() => this.renderTimeline());
      if (typeof this.renderLibraries === "function") {
        this.renderLibraries();
      }
      return;
    }

    // 没有自定义处理时直接重新渲染时间线
    if (typeof this.renderTimeline === "function") {
      this.renderTimeline();
      if (typeof this.renderLibraries === "function") {
        this.renderLibraries();
      }
    }
  },

  // 关闭编辑器
  closeEditor() {
    historyManager.clear();

    EditorHelper.closeEditor({
      modalId: this.modalId,
      // 关闭前先清理拖拽和动画状态
      beforeClose: () => {
        this.sortableInstances = this.sortableInstances.filter(
          (instance) => !!instance?.el,
        );
        // 逐个销毁拖拽实例
        this.sortableInstances.forEach((instance) => instance.destroy());
        this.sortableInstances = [];

        if (this.scrollAnimationFrame) {
          cancelAnimationFrame(this.scrollAnimationFrame);
          this.scrollAnimationFrame = null;
        }

        if (typeof this.onBeforeClose === "function") {
          this.onBeforeClose();
        }
      },
    });
  },

  // 删除一条布局动作
  deleteLayoutAction(actionId) {
    this.executeCommand((currentState) => {
      currentState.actions = currentState.actions.filter(
        (actionItem) => actionItem.id !== actionId,
      );
    });
  },

  // 按输入文字创建项目数据
  buildProjectState(rawText) {
    const baseProject = buildProjectData(
      rawText,
      state.currentConfig,
    );
    const createAction =
      typeof this.actionFromSegment === "function"
        ? this.actionFromSegment.bind(this)
        // 默认按对话动作来创建
        : (index, text, speakers) => ({
            id: `action-id-${Date.now()}-${index}`,
            type: "talk",
            text,
            speakers,
            motions: [],
          });

    return {
      ...baseProject,
      actions: baseProject.actions.map((action, index) =>
        createAction(index, action.text, action.speakers),
      ),
    };
  },

  // 准备编辑器要用的项目状态
  async prepareProjectState(options = {}) {
    const rawText = document.getElementById("inputText").value;
    const trimmedText = rawText.trim();
    const projectState = state.projectFile;
    let initialState;

    // 先判断是继续现有进度 还是按当前文字新建项目
    if (projectState) {
      initialState = projectState;
      // 有现成进度时直接使用
      if (typeof options.onProjectLoad === "function") {
        options.onProjectLoad(initialState, { rawText });
      }
    } else {
      initialState = this.buildProjectState(trimmedText ? rawText : "");
      // 没有进度时按当前文字新建
      if (typeof options.onProjectCreate === "function") {
        options.onProjectCreate({ rawText });
      }
    }

    this.projectFileState = DataUtils.deepClone(initialState);
    this.originalStateOnOpen = JSON.stringify(initialState);
    historyManager.clear();
  },

  // 打开一个项目编辑器
  async openProjectEditor(options = {}) {
    const {
      buttonId = this.openButtonId,
      loadingText = "加载中...",
      beforePrepareProject,
      afterOpen,
    } = options;

    await EditorHelper.openEditor({
      editor: this,
      modalId: this.modalId,
      buttonId,
      loadingText,
      // 打开前先准备项目数据
      beforeOpen: async () => {
        if (typeof beforePrepareProject === "function") {
          await beforePrepareProject.call(this);
        }

        try {
          // 打开编辑器时静默准备项目状态，不再弹出提示条打断操作。
          await this.prepareProjectState();
        } catch (error) {
          ui.showStatus(
            `加载编辑器失败: ${error.response?.data?.error || error.message}`,
            "error"
          );
          throw error;
        }
      },
      // 打开后再跑编辑器自己的事
      afterOpen: async () => {
        if (typeof afterOpen === "function") {
          await afterOpen.call(this);
        }
      },
    });
  },

  // 绑定通用按钮和快捷键
  initCommonEvents() {
    // 刷新撤销和重做按钮状态
    const updateHistoryButtons = ({ canUndo, canRedo }) => {
      this.domCache.undoBtn.disabled = !canUndo;
      this.domCache.redoBtn.disabled = !canRedo;
    };

    // 点按钮时执行撤销
    this.domCache.undoBtn.addEventListener("click", () => historyManager.undo());
    // 点按钮时执行重做
    this.domCache.redoBtn.addEventListener("click", () => historyManager.redo());
    updateHistoryButtons({
      canUndo: historyManager.undoStack.length > 0,
      canRedo: historyManager.redoStack.length > 0,
    });

    document
      .getElementById(this.saveButtonId)
      // 点击保存按钮
      .addEventListener("click", () => this.save());
    document
      .getElementById(this.importButtonId)
      // 点击导入按钮
      .addEventListener("click", () => this.importProject());
    document
      .getElementById(this.exportButtonId)
      // 点击导出按钮
      .addEventListener("click", () =>
        projectManager.export(this.projectFileState),
      );

    // 尝试关闭编辑器
    const attemptCloseEditor = (closeEvent = null) => {
      if (JSON.stringify(this.projectFileState) !== this.originalStateOnOpen) {
        // 有没保存的改动时先问用户
        if (!confirm("您有未保存的更改，确定要关闭吗？")) {
          if (closeEvent) {
            closeEvent.stopPropagation();
            closeEvent.preventDefault();
          }
          return;
        }
      }

      if (closeEvent) {
        closeEvent.stopPropagation();
        closeEvent.preventDefault();
      }
      this.closeEditor();
    };

    this.domCache.modal
      .querySelector(".modal-close")
      // 点击关闭按钮时尝试关闭窗口
      .addEventListener("click", (closeEvent) => {
        attemptCloseEditor(closeEvent);
      }, true);

    // 历史变化时刷新按钮状态
    document.addEventListener("historychange", (historyChangeEvent) => {
      updateHistoryButtons(historyChangeEvent.detail);
    });

    // 绑定编辑器里的键盘快捷键
    this.domCache.modal.addEventListener("keydown", (keyboardEvent) => {
      if (keyboardEvent.key === "Escape") {
        attemptCloseEditor(keyboardEvent);
        return;
      }

      // 输入控件里保留原生按键 不拦截撤销重做
      if (
        keyboardEvent.target.tagName === "INPUT" ||
        keyboardEvent.target.tagName === "SELECT" ||
        keyboardEvent.target.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (!(keyboardEvent.ctrlKey || keyboardEvent.metaKey)) {
        return;
      }

      if (keyboardEvent.key === "z") {
        keyboardEvent.preventDefault();
        historyManager.undo();
        return;
      }

      if (
        keyboardEvent.key === "y" ||
        (keyboardEvent.shiftKey &&
          (keyboardEvent.key === "z" || keyboardEvent.key === "Z"))
      ) {
        keyboardEvent.preventDefault();
        historyManager.redo();
      }
    });
  },
};

// 给编辑器添加通用方法
export function attachEditorCore(editor, baseEditor) {
  // 先把基础编辑器上的公共状态挂到具体编辑器实例上
  Object.assign(editor, {
    projectFileState: baseEditor.projectFileState,
    originalStateOnOpen: baseEditor.originalStateOnOpen,
    activeGroupIndex: baseEditor.activeGroupIndex,
    renderCallback: baseEditor.renderCallback,
    renderHintResolver: baseEditor.renderHintResolver,
    groupSize: baseEditor.groupSize,
  });
  editor.executeCommand = BaseEditor.prototype.executeCommand;
  editor.resolveGlobalIndex = BaseEditor.prototype.resolveGlobalIndex;
  editor.resolveHeaderOffset = BaseEditor.prototype.resolveHeaderOffset;
  Object.assign(editor, editorCoreMethods);
}

// 给编辑器添加共用的分组列表渲染骨架
export function attachGroupedActionRenderer(editor, options = {}) {
  const {
    containerKey,
    renderMethodName,
    resetMethodName,
    buildRenderers,
    getReturnValue,
    signatureResolver = DataUtils.actionSignature,
    scrollOffset = 110,
    shouldScrollOnOpen = true,
  } = options;
  const renderCache = createCache();

  const renderView = function () {
    const container = this.domCache?.[containerKey];
    if (!container) {
      return typeof getReturnValue === "function"
        ? getReturnValue.call(this)
        : undefined;
    }

    const actions = this.projectFileState?.actions || [];
    const groupingEnabled = this.domCache.groupCheckbox?.checked || false;
    const rendererSet = buildRenderers.call(this) || {};
    const rawContextSignature =
      rendererSet.contextSignature ??
      rendererSet.configSignature ??
      "";
    const contextSignature =
      typeof rawContextSignature === "function"
        ? rawContextSignature.call(this)
        : rawContextSignature;

    renderFast({
      container,
      actions,
      cache: renderCache,
      renderCard: rendererSet.renderSingleCard,
      updateCard: rendererSet.updateCard,
      signatureResolver,
      groupingEnabled,
      groupSize: this.groupSize,
      activeGroupIndex: this.activeGroupIndex,
      contextSignature,
      onGroupToggle: (groupIndex) => {
        const isOpening = this.activeGroupIndex !== groupIndex;
        this.activeGroupIndex = isOpening ? groupIndex : null;
        renderView.call(this);

        if (isOpening && shouldScrollOnOpen) {
          setTimeout(() => {
            scrollToGroupHeader(
              this.domCache?.[containerKey],
              groupIndex,
              scrollOffset,
            );
          }, 0);
        }
      },
    });

    return typeof getReturnValue === "function"
      ? getReturnValue.call(this)
      : undefined;
  };

  Object.assign(editor, {
    [resetMethodName]: () => clearCache(renderCache),
    [renderMethodName]: renderView,
  });
}

// 分组切换后按统一逻辑重绘并按需滚到组头
export function rerenderOnGroupToggle(
  editor,
  groupIndex,
  isOpening,
  options = {},
) {
  const {
    renderView,
    containerKey = "timeline",
    scrollOffset = 110,
    shouldScrollOnOpen = true,
  } = options;
  renderView.call(editor);

  if (!isOpening || !shouldScrollOnOpen) {
    return;
  }

  setTimeout(() => {
    scrollToGroupHeader(editor.domCache?.[containerKey], groupIndex, scrollOffset);
  }, 0);
}

// 展开浮层后统一监听一次外部点击关闭
export function bindOutsideClickDismiss(container, onDismiss) {
  if (!container || typeof onDismiss !== "function") {
    return;
  }

  setTimeout(() => {
    document.addEventListener(
      "click",
      function onClickOutside(clickEvent) {
        if (!container.contains(clickEvent.target)) {
          onDismiss(clickEvent);
          document.removeEventListener("click", onClickOutside);
        }
      },
      { once: true },
    );
  }, 0);
}
