// 编辑器通用能力合集：保存/导入导出/关闭/撤销重做/准备项目数据等
import { DataUtils } from "@utils/DataUtils.js";
import { EditorHelper } from "@utils/EditorHelper.js";
import { createProjectFileFromText } from "@utils/ConverterCore.js";
import { historyManager } from "@managers/historyManager.js";
import { editorService } from "@services/EditorService.js";

export const BaseEditorMixin = {
  // 共享状态：Sortable 实例与自动滚动相关
  sortableInstances: [],
  scrollAnimationFrame: null,
  scrollSpeed: 0,

  // 通过 BaseEditor 执行一次“可撤销的修改”（changeFn 会拿到 currentState）
  _executeCommand(changeFn) {
    this.baseEditor.executeCommand(changeFn);
  },

  // 保存：把编辑器里的临时状态写回全局项目进度
  async save() {
    await EditorHelper.saveEditor({
      editor: this.baseEditor,
      modalId: this.modalId,
      buttonId: this.saveButtonId,
      applyChanges: () => {
        editorService.projectManager.save(
          this.projectFileState,
          (savedState) => {
            this.baseEditor.originalStateOnOpen = JSON.stringify(savedState);
          }
        );
      },
    });
  },

  // 导出：把当前项目进度下载成 JSON 文件
  exportProject() {
    editorService.projectManager.export(this.projectFileState);
  },

  // 导入：选择一个项目进度 JSON，并替换当前编辑器状态
  async importProject() {
    const importedProject = await editorService.projectManager.import();
    if (importedProject) {
      this.projectFileState = importedProject;
      this.originalStateOnOpen = JSON.stringify(importedProject);
      editorService.setProjectState(DataUtils.deepClone(importedProject));
      historyManager.clear();

      // 调用子类的后处理钩子
      if (this.afterImport) {
        this.afterImport();
      }
    }
  },

  // 关闭编辑器：做清理（拖拽实例、滚动动画、子模块钩子）
  _closeEditor() {
    EditorHelper.closeEditor({
      modalId: this.modalId,
      beforeClose: () => {
        // 销毁 Sortable 实例
        this.sortableInstances = this.sortableInstances.filter(
          (instance) => !!instance?.el
        );
        this.sortableInstances.forEach((instance) => instance?.destroy());
        this.sortableInstances = [];

        // 停止滚动动画
        if (this.scrollAnimationFrame) {
          cancelAnimationFrame(this.scrollAnimationFrame);
          this.scrollAnimationFrame = null;
        }

        // 调用子类的清理钩子
        if (this.onBeforeClose) {
          this.onBeforeClose();
        }
      },
    });
  },

  // 删除一条 layout action（按 actionId）
  _deleteLayoutAction(actionId) {
    this._executeCommand((currentState) => {
      currentState.actions = currentState.actions.filter(
        (a) => a.id !== actionId
      );
    });
  },

  // 把“分段后的文本”组装成项目文件（actions 数组）
  _createProjectFileFromSegments(segments) {
    const text = segments.join("\n\n");
    const baseProject = createProjectFileFromText(
      text,
      editorService.getCurrentConfig()
    );
    const actions = baseProject.actions.map((action, index) =>
      this._createActionFromSegment
        ? this._createActionFromSegment(index, action.text, action.speakers)
        : action
    );
    return { ...baseProject, actions };
  },

  // 打开编辑器前准备 projectFileState：优先用已保存进度，否则用输入文本创建
  async _prepareProjectState(options = {}) {
    const { onExistingProjectLoaded, onNewProjectCreated } = options;
    const inputElement = document.getElementById("inputText");
    const rawText = inputElement ? inputElement.value : "";
    const trimmedText = rawText?.trim() || "";
    const projectState = editorService.getProjectState();
    let initialState;

    if (projectState) {
      initialState = projectState;
      onExistingProjectLoaded?.(initialState, { rawText });
    } else if (trimmedText) {
      const response = await axios.post("/api/segment-text", {
        text: rawText,
      });
      const segments = response.data?.segments || [];
      initialState = this._createProjectFileFromSegments(segments);
      onNewProjectCreated?.(initialState, { rawText, segments });
    } else {
      initialState = this._createProjectFileFromSegments([]);
      onNewProjectCreated?.(initialState, { rawText, segments: [] });
    }

    this.projectFileState = DataUtils.deepClone(initialState);
    this.originalStateOnOpen = JSON.stringify(initialState);
    historyManager.clear();
  },

  // 把一段文本变成一个 action（子类可覆盖，默认创建 talk）
  _createActionFromSegment(index, text, speakers) {
    // 默认实现：创建基本的 talk action
    return {
      id: `action-id-${Date.now()}-${index}`,
      type: "talk",
      text: text,
      speakers: speakers,
      motions: [],
    };
  },
};
