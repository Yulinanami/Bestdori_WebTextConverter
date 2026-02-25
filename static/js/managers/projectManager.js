import { DataUtils } from "@utils/DataUtils.js";
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { FileUtils } from "@utils/FileUtils.js";
import { apiService } from "@services/ApiService.js";

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
  async export(currentState) {
    if (!currentState) {
      ui.showStatus("没有可导出的内容。", "error");
      return;
    }

    try {
      const exportResult = await apiService.exportProjectFile(currentState);
      const downloadBlob = await apiService.downloadResult(
        exportResult.content,
        exportResult.filename,
      );
      FileUtils.downloadAsFile(downloadBlob, exportResult.filename);
      ui.showStatus("项目导出成功！", "success");
    } catch (error) {
      ui.showStatus(`导出失败: ${error.message}`, "error");
    }
  },

  // 选择并导入一个“编辑进度 JSON”，成功就返回项目数据，取消则返回 null
  async import() {
    return new Promise((resolve) => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json";
      fileInput.onchange = async (changeEvent) => {
        const file = changeEvent.target.files[0];
        if (!file) {
          resolve(null);
          return;
        }
        try {
          const response = await apiService.importProjectFile(file);
          const importedProject = response.projectFile;
          ui.showStatus("项目导入成功！", "success");
          resolve(importedProject);
        } catch (error) {
          ui.showStatus(`导入失败: ${error.message}`, "error");
          resolve(null);
        }
      };
      fileInput.click();
    });
  },
};
