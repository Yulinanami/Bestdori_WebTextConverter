// 上传文件→读取文本和下载结果 JSON的整套流程（仅保留数据及业务中转，拆离了渲染层）
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { apiService } from "@services/ApiService.js";
import { FileUtils } from "@utils/FileUtils.js";
import { fileView } from "@views/fileView.js";
import { converterView } from "@views/converterView.js";

export const fileHandler = {
  // 初始化：委托给视图层绑定
  init() {
    fileView.init(this);
  },

  // 上传文件到后端，并将文本填充至转换输入框
  async handleFileUpload(file) {
    if (!file) return;

    fileView.setUploadLoading(true);

    try {
      ui.showStatus("正在上传文件...", "info");
      const uploadResponse = await apiService.uploadFile(file);
      
      // 回写数据到主输入视图
      converterView.setInputText(uploadResponse.content);

      if (state.projectFile) {
        state.projectFile = null;
      }

      ui.showStatus("文件上传成功！", "success");
    } catch (error) {
      ui.showStatus(error.message, "error");
    } finally {
      fileView.setUploadLoading(false);
      fileView.clearFileInput();
    }
  },

  // 把当前转换结果下载为 .json 文件
  async downloadResult() {
    if (!state.currentResult) {
      ui.showStatus("没有可下载的结果！", "error");
      return;
    }

    // 委托给视图控制下载按钮的 loading 动效
    await fileView.runWithButtonLoading(
      "downloadBtn",
      "下载中...",
      async () => {
        const filename = `result_${new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:-]/g, "")}.json`;

        try {
          const blob = await apiService.downloadResult(
            state.currentResult,
            filename,
          );

          FileUtils.downloadAsFile(blob, filename);
          ui.showStatus("文件下载成功！", "success");
        } catch (error) {
          ui.showStatus(error.message, "error");
        }
      }
    );
  },
};

