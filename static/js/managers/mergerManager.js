// 管理文件合并页面（仅保留纯数据和业务逻辑，拆离了渲染层）
import { ui } from "@utils/uiUtils.js";
import { FileUtils } from "@utils/FileUtils.js";
import { apiService } from "@services/ApiService.js";
import { mergerView } from "@views/mergerView.js";

export const mergerManager = {
  mode: "bestdori", // "bestdori" or "project"
  files: [], // Array of { id, name, data }
  fileIdCounter: 0,
  mergedResultText: "",

  // 初始化，绑定视图
  init() {
    mergerView.init(this);
  },

  // 排序同步
  reorderFiles(oldIndex, newIndex) {
    const movedItem = this.files.splice(oldIndex, 1)[0];
    this.files.splice(newIndex, 0, movedItem);
  },

  // 上传并导入文件
  async handleFilesUpload(fileList) {
    if (!fileList || fileList.length === 0) return;

    // 逐个传到后端解析
    for (const file of Array.from(fileList)) {
      try {
        const importedFile = (await apiService.importMergeFile(file)).file;

        this.files.push({
          id: `merger-file-${this.fileIdCounter++}`,
          name: importedFile.name,
          data: importedFile.data,
        });
      } catch (error) {
        ui.showStatus(error.message, "error");
      }
    }

    // 清空 input 方便重新选择同名文件
    mergerView.clearFileInput();
    mergerView.updateUI();
  },

  // 清空文件和结果
  clearFiles() {
    this.files = [];
    this.mergedResultText = "";
    mergerView.clearUI();
  },

  // 删除一个文件
  removeFile(fileId) {
    this.files = this.files.filter((fileEntry) => fileEntry.id !== fileId);
    mergerView.updateUI();
  },

  // 发起合并
  async mergeFiles() {
    if (this.files.length < 1) {
      ui.showStatus("请至少上传一个文件。", "warning");
      return;
    }

    mergerView.setLoading(true);

    // 调后端做合并
    try {
      // 先按当前拖拽顺序整理后端需要的文件列表
      const filesPayload = this.files.map((fileEntry) => ({
        name: fileEntry.name,
        data: fileEntry.data,
      }));

      const response = await apiService.mergeFiles(filesPayload);
      this.mergedResultText = JSON.stringify(response.result, null, 2);
      this.mode = response.mode || "bestdori";
      mergerView.displayMergeResult(this.mergedResultText, this.mode);
    } catch (error) {
      if (error.message.includes("每个文件必须是同类文件")) {
        this.clearFiles();
      }
      ui.showStatus(`合并失败: ${error.message}`, "error");
    } finally {
      mergerView.setLoading(false, this.files.length < 1);
    }
  },

  // 下载合并结果
  async downloadMergedResult() {
    if (!this.mergedResultText) return;
    const filename =
      this.mode === "bestdori"
          ? `merged_bestdori_${Date.now()}.json`
          : `merged_project_${Date.now()}.json`;

    try {
      const downloadBlob = await apiService.downloadResult(
        this.mergedResultText,
        filename,
      );
      FileUtils.downloadAsFile(downloadBlob, filename);
      ui.showStatus("下载成功！", "success");
    } catch (error) {
      ui.showStatus(`下载失败: ${error.message}`, "error");
    }
  },

  // 复制合并结果
  async copyMergedResult() {
    if (!this.mergedResultText) return;
    try {
      await navigator.clipboard.writeText(this.mergedResultText);
      ui.showStatus("合并结果已复制到剪贴板！", "success");
    } catch {
      ui.showStatus("复制失败，请手动选择复制。", "error");
    }
  },

  // 复制并跳转至 Bestdori
  async gotoBestdoriMerge() {
    if (!this.mergedResultText) return;
    try {
      await navigator.clipboard.writeText(this.mergedResultText);
      ui.showStatus("合并结果已复制，正在跳转到 Bestdori...", "success");
    } catch {
      ui.showStatus("复制失败，请手动选择复制后跳转。", "warning");
    }
    setTimeout(() => {
      window.open("https://bestdori.com/community/stories/new", "_blank");
    }, 500);
  },
};

