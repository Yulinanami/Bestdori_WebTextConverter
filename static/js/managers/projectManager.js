import { DataUtils } from "@utils/DataUtils.js";
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { FileUtils } from "@utils/FileUtils.js";

export const projectManager = {
  // 保存当前编辑进度到内存状态（并可在保存后做回调）
  save(currentState, onComplete) {
    const newState = DataUtils.deepClone(currentState);
    state.set("projectFile", newState);
    ui.showStatus("工作进度已保存！", "success");
    if (onComplete) {
      onComplete(newState);
    }
  },

  // 把当前编辑进度导出成一个 .json 文件（方便以后继续编辑）
  export(currentState) {
    if (!currentState) {
      ui.showStatus("没有可导出的内容。", "error");
      return;
    }

    // 深拷贝后清理掉运行时/废弃字段，避免泄漏到导出文件
    const exportData = DataUtils.deepClone(currentState);
    if (Array.isArray(exportData.actions)) {
      exportData.actions.forEach((action) => {
        delete action.characterStates;
      });
    }

    const dataStr = JSON.stringify(exportData, null, 2);
    const filename =
      currentState.projectName || `bestdori_project_${Date.now()}.json`;
    FileUtils.downloadAsFile(dataStr, filename);
  },

  // 选择并导入一个“编辑进度 JSON”，成功就返回项目数据，取消则返回 null
  async import() {
    return new Promise((resolve) => {
      // 简单校验：确认这是“编辑器进度文件”，不是最终导出的 Bestdori JSON
      const isValidProjectFile = (data) => {
        if (!data || !Array.isArray(data.actions)) return false;
        return data.actions.every((action) => {
          if (!action || typeof action !== "object") return false;
          if (typeof action.type !== "string") return false;
          if (action.type === "talk") {
            return (
              Array.isArray(action.speakers) && typeof action.text === "string"
            );
          }
          if (action.type === "layout") {
            return (
              typeof action.layoutType === "string" &&
              Object.hasOwn(action, "characterId")
            );
          }
          return false;
        });
      };

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
            if (!isValidProjectFile(importedProject)) {
              throw new Error(
                "文件格式不符合编辑器进度，需导入“保存进度”导出的 JSON。",
              );
            }
            ui.showStatus("项目导入成功！", "success");
            resolve(importedProject);
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
};
