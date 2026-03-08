// 项目进度的保存导入导出
import { DataUtils } from "@utils/DataUtils.js";
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { FileUtils } from "@utils/FileUtils.js";
import { apiService } from "@services/ApiService.js";

export const projectManager = {
  // 保存当前进度
  save(currentState, onComplete) {
    const newState = DataUtils.deepClone(currentState);
    state.projectFile = newState;
    ui.showStatus("工作进度已保存！", "success");
    if (onComplete) {
      onComplete(newState);
    }
  },

  // 导出当前进度
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

  // 导入一个项目文件
  async import() {
    // 等用户选一个项目文件
    return new Promise((resolve) => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json";
      // 选中文件后开始导入
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
