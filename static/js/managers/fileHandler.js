// 上传文件→读取文本和下载结果 JSON的整套流程
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { apiService } from "@services/ApiService.js";
import { FileUtils } from "@utils/FileUtils.js";

export const fileHandler = {
  // 初始化：绑定上传/下载按钮，并启用拖拽上传
  init() {
    const fileInput = document.getElementById("fileInput");
    if (fileInput) {
      fileInput.addEventListener("change", this.handleFileUpload.bind(this));
    }

    const downloadButton = document.getElementById("downloadBtn");
    if (downloadButton) {
      downloadButton.addEventListener("click", this.downloadResult.bind(this));
    }

    this.setupFileDragDrop();
  },

  // 让上传区域支持“拖拽文件进来”
  setupFileDragDrop() {
    const fileUpload = document.getElementById("fileUpload");
    if (!fileUpload) {
      return;
    }
    // 给拖拽事件都加上默认拦截
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      fileUpload.addEventListener(eventName, this.preventDefaults, false);
    });

    // 拖进来时高亮上传框
    ["dragenter", "dragover"].forEach((eventName) => {
      fileUpload.addEventListener(
        eventName,
        () => fileUpload.classList.add("dragover"),
        false,
      );
    });

    // 拖走或放下后取消高亮
    ["dragleave", "drop"].forEach((eventName) => {
      fileUpload.addEventListener(
        eventName,
        () => fileUpload.classList.remove("dragover"),
        false,
      );
    });
    fileUpload.addEventListener("drop", this.handleDrop.bind(this), false);
  },

  // 拦截浏览器默认拖拽行为（避免打开文件/跳转页面）
  preventDefaults(dragEvent) {
    dragEvent.preventDefault();
    dragEvent.stopPropagation();
  },

// 拖拽松手后交给同一个上传入口
  handleDrop(dropEvent) {
    dropEvent.preventDefault();
    dropEvent.stopPropagation();
    const dataTransfer = dropEvent.dataTransfer;
    const files = dataTransfer.files;
    if (files.length > 0) {
      document.getElementById("fileInput").files = files;
      this.handleFileUpload({ target: { files: files } });
    }
  },

  // 上传文件到后端，并把解析出的文本填回输入框
  async handleFileUpload(changeEvent) {
    const file = changeEvent.target.files[0];
    if (!file) return;

    const fileUploadLabel = document.querySelector(".file-upload-label");
    const originalContent = fileUploadLabel.innerHTML;
    fileUploadLabel.innerHTML = `
            <div>
                <div class="loading" style="margin: 0 auto 10px; font-size: 2rem;"></div>
                <div style="font-weight: 600;">正在上传文件...</div>
                <div style="font-size: 0.9rem; color: #718096;">请稍候</div>
            </div>
        `;

    try {
      ui.showStatus("正在上传文件...", "info");

      const uploadResponse = await apiService.uploadFile(file);

      document.getElementById("inputText").value = uploadResponse.content;

      if (state.projectFile) {
        state.projectFile = null;
      }

      ui.showStatus("文件上传成功！", "success");
    } catch (error) {
      ui.showStatus(error.message, "error");
    } finally {
      fileUploadLabel.innerHTML = originalContent;
      document.getElementById("fileInput").value = "";
    }
  },

  // 把当前转换结果下载为 .json 文件
  async downloadResult() {
    const buttonId = "downloadBtn";
    if (!state.currentResult) {
      ui.showStatus("没有可下载的结果！", "error");
      return;
    }

    await ui.withButtonLoading(
      buttonId,
      // 请求下载内容并保存
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
      },
      "下载中...",
    );
  },
};
