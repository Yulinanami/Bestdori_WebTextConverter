import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";

export const projectManager = {
  /**
   * 保存项目。将传入的当前状态同步到全局状态。
   * @param {object} currentState - 编辑器当前的临时项目状态。
   * @param {function} onComplete - 操作完成后的回调函数 (例如关闭模态框)。
   */
  save(currentState, onComplete) {
    const newState = JSON.parse(JSON.stringify(currentState));
    state.set("projectFile", newState);
    ui.showStatus("工作进度已保存！", "success");
    if (onComplete) {
      onComplete(newState); 
    }
  },

  /**
   * 导出项目为 JSON 文件。
   * @param {object} currentState - 编辑器当前的临时项目状态。
   */
  export(currentState) {
    if (!currentState) {
      ui.showStatus("没有可导出的内容。", "error");
      return;
    }
    const dataStr = JSON.stringify(currentState, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const filename =
      currentState.projectName || `bestdori_project_${Date.now()}.json`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * 导入项目文件。
   * @returns {Promise<object|null>} 返回一个包含导入的项目数据，如果用户取消则返回null。
   */
  async import() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const importedProject = JSON.parse(event.target.result);
            if (importedProject && importedProject.actions) {
              ui.showStatus("项目导入成功！", "success");
              resolve(importedProject);
            } else {
              throw new Error("无效的项目文件格式。");
            }
          } catch (err) {
            ui.showStatus(`导入失败: ${err.message}`, "error");
            resolve(null);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
  },

  /**
   * 恢复默认。这个函数的逻辑与具体数据源强相关，所以它只提供框架。
   * @param {function} getDefaultStateFn - 一个能返回全新默认状态的函数。
   * @param {function} onComplete - 恢复成功后的回调。
   */
  async reset(getDefaultStateFn, onComplete) {
    if (!confirm("确定要恢复默认吗？当前编辑模式下的所有修改都将丢失。")) {
      return;
    }
    try {
      const newState = await getDefaultStateFn();
      ui.showStatus("已恢复为默认状态。", "info");
      if (onComplete) {
        onComplete(newState);
      }
    } catch (error) {
      ui.showStatus(`恢复默认失败: ${error.message}`, "error");
    }
  },
};
