// 三个编辑器共用的方法
import { DataUtils } from "@utils/DataUtils.js";
import { EditorHelper } from "@utils/EditorHelper.js";
import { BaseEditor } from "@utils/BaseEditor.js";
import { createProjectFileFromText } from "@utils/ConverterCore.js";
import { ui } from "@utils/uiUtils.js";
import { state } from "@managers/stateManager.js";
import { historyManager } from "@managers/historyManager.js";
import { projectManager } from "@managers/projectManager.js";

const editorCoreMethods = {
  sortableInstances: [],
  scrollAnimationFrame: null,
  scrollSpeed: 0,

  // 刷新当前项目用到的角色列表
  renderCharacterListForCurrentProject() {
    if (
      typeof this.renderCharacterList === "function" &&
      typeof this.collectUsedCharacterIds === "function"
    ) {
      this.renderCharacterList(this.collectUsedCharacterIds());
    }
  },

  // 先渲染主区域 再渲染角色列表
  renderPrimaryViewWithCharacters(renderView) {
    const usedCharacterIds = renderView.call(this);
    if (typeof this.renderCharacterList === "function") {
      this.renderCharacterList(usedCharacterIds ?? this.collectUsedCharacterIds?.());
    }
  },

  // 重置临时状态
  resetTransientState(nextState) {
    Object.entries(nextState).forEach(([key, value]) => {
      this[key] = typeof value === "function" ? value() : value;
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

    if (
      typeof this.renderPrimaryViewWithCharacters === "function" &&
      typeof this.renderCanvas === "function"
    ) {
      this.renderPrimaryViewWithCharacters(() => this.renderCanvas());
      return;
    }

    if (
      typeof this.renderPrimaryViewWithCharacters === "function" &&
      typeof this.renderTimeline === "function"
    ) {
      this.renderPrimaryViewWithCharacters(() => this.renderTimeline());
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
  createProjectFile(rawText) {
    const baseProject = createProjectFileFromText(
      rawText,
      state.currentConfig,
    );
    const createAction =
      typeof this.createActionFromSegment === "function"
        ? this.createActionFromSegment.bind(this)
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

    if (projectState) {
      initialState = projectState;
      // 有现成进度时直接使用
      if (typeof options.onExistingProjectLoaded === "function") {
        options.onExistingProjectLoaded(initialState, { rawText });
      }
    } else {
      initialState = this.createProjectFile(trimmedText ? rawText : "");
      // 没有进度时按当前文字新建
      if (typeof options.onNewProjectCreated === "function") {
        options.onNewProjectCreated({ rawText });
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
      beforePrepareProjectState,
      afterOpen,
    } = options;

    await EditorHelper.openEditor({
      editor: this,
      modalId: this.modalId,
      buttonId,
      loadingText,
      // 打开前先准备项目数据
      beforeOpen: async () => {
        if (typeof beforePrepareProjectState === "function") {
          await beforePrepareProjectState.call(this);
        }

        try {
          await this.prepareProjectState({
            // 读到已有进度时给个提示
            onExistingProjectLoaded: () =>
              ui.showStatus("已加载现有项目进度。", "info"),
            // 新建项目时只在有文字时提示
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
  Object.assign(editor, {
    projectFileState: baseEditor.projectFileState,
    originalStateOnOpen: baseEditor.originalStateOnOpen,
    activeGroupIndex: baseEditor.activeGroupIndex,
    renderCallback: baseEditor.renderCallback,
    commandRenderHintResolver: baseEditor.commandRenderHintResolver,
    groupSize: baseEditor.groupSize,
  });
  editor.executeCommand = BaseEditor.prototype.executeCommand;
  editor.resolveGlobalIndex = BaseEditor.prototype.resolveGlobalIndex;
  editor.resolveHeaderOffset = BaseEditor.prototype.resolveHeaderOffset;
  Object.assign(editor, editorCoreMethods);
}
