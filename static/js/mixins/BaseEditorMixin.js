// 基础编辑器功能 Mixin
// 提供保存、导入、导出、关闭、命令执行等核心功能
import { DataUtils } from "@utils/DataUtils.js";
import { EditorHelper } from "@utils/EditorHelper.js";
import { historyManager } from "@managers/historyManager.js";
import { editorService } from "@services/EditorService.js";

export const BaseEditorMixin = {
  // 共享属性
  sortableInstances: [],
  scrollAnimationFrame: null,
  scrollSpeed: 0,

  /**
   * 使用命令模式执行状态修改（支持撤销/重做）
   * @param {Function} changeFn - 接收 currentState 参数的修改函数
   */
  _executeCommand(changeFn) {
    this.baseEditor.executeCommand(changeFn);
  },

  /**
   * 保存编辑器状态到全局项目状态
   */
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

  /**
   * 导出项目文件为 JSON
   */
  exportProject() {
    editorService.projectManager.export(this.projectFileState);
  },

  /**
   * 导入项目文件
   */
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

  /**
   * 关闭编辑器并清理资源
   */
  _closeEditor() {
    EditorHelper.closeEditor({
      modalId: this.modalId,
      beforeClose: () => {
        // 销毁 Sortable 实例
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

  /**
   * 删除布局动作
   * @param {string} actionId - 动作ID
   */
  _deleteLayoutAction(actionId) {
    this._executeCommand((currentState) => {
      currentState.actions = currentState.actions.filter(
        (a) => a.id !== actionId
      );
    });
  },

  /**
   * 从文本片段创建项目文件
   * @param {string[]} segments - 文本片段数组
   * @returns {Object} 项目文件对象
   */
  _createProjectFileFromSegments(segments) {
    const characterMap = new Map(
      Object.entries(editorService.getCurrentConfig()).map(([name, ids]) => [
        name,
        { characterId: ids[0], name: name },
      ])
    );

    const newProjectFile = {
      version: "1.0",
      actions: segments.map((text, index) => {
        let speakers = [];
        let cleanText = text;
        const match = text.match(/^(.*?)\s*[：:]\s*(.*)$/s);

        if (match) {
          const potentialSpeakerName = match[1].trim();
          if (characterMap.has(potentialSpeakerName)) {
            speakers.push(characterMap.get(potentialSpeakerName));
            cleanText = match[2].trim();
          }
        }

        // 调用子类实现的 createAction 方法
        return this._createActionFromSegment(index, cleanText, speakers);
      }),
    };

    return newProjectFile;
  },

  /**
   * 在打开编辑器前初始化项目状态
   * @param {Object} options
   * @param {Function} options.onExistingProjectLoaded - 已有项目加载后的回调
   * @param {Function} options.onNewProjectCreated - 新项目创建后的回调
   */
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

  /**
   * 从片段创建单个 action（由子类实现）
   * @param {number} index - 索引
   * @param {string} text - 文本内容
   * @param {Array} speakers - 说话人数组
   * @returns {Object} action 对象
   */
  _createActionFromSegment(index, text, speakers) {
    // 默认实现：创建基本的 talk action
    return {
      id: `action-id-${Date.now()}-${index}`,
      type: "talk",
      text: text,
      speakers: speakers,
    };
  },
};
