// 负责上传文件→读取文本和下载结果 JSON的整套流程
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { apiService } from "@services/ApiService.js";

// 允许上传的文件类型
const VALID_EXTENSIONS = [".txt", ".docx", ".md"];

export const fileHandler = {
  // 初始化：绑定上传/下载按钮，并启用拖拽上传
  init() {
    const fileInput = document.getElementById("fileInput");
    if (fileInput) {
      fileInput.addEventListener("change", this.handleFileUpload.bind(this));
    }

    const downloadBtn = document.getElementById("downloadBtn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", this.downloadResult.bind(this));
    }

    this.setupFileDragDrop();
  },

  // 让上传区域支持“拖拽文件进来”
  setupFileDragDrop() {
    const fileUpload = document.getElementById("fileUpload");
    if (!fileUpload) {
      return;
    }
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      fileUpload.addEventListener(eventName, this.preventDefaults, false);
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      fileUpload.addEventListener(
        eventName,
        () => fileUpload.classList.add("dragover"),
        false
      );
    });

    ["dragleave", "drop"].forEach((eventName) => {
      fileUpload.addEventListener(
        eventName,
        () => fileUpload.classList.remove("dragover"),
        false
      );
    });
    fileUpload.addEventListener("drop", this.handleDrop.bind(this), false);
  },

  // 拦截浏览器默认拖拽行为（避免打开文件/跳转页面）
  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  },

  // 拖拽松手时：把文件交给统一的上传处理
  handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      document.getElementById("fileInput").files = files;
      this.handleFileUpload({ target: { files: files } });
    }
  },

  // 上传文件到后端，并把解析出的文本填回输入框
  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const filename = file.name.toLowerCase();
    const isValidFile = VALID_EXTENSIONS.some((ext) => filename.endsWith(ext));
    if (!isValidFile) {
      ui.showStatus("只支持 .txt, .docx, .md 文件！", "error");
      return;
    }

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
      ui.showProgress(20);
      ui.showStatus("正在上传文件...", "info");

      const data = await apiService.uploadFile(file);

      ui.showProgress(100);
      document.getElementById("inputText").value = data.content;

      if (state.get("projectFile")) {
        state.set("projectFile", null);
      }

      ui.showStatus("文件上传成功！", "success");
      setTimeout(() => ui.hideProgress(), 1000);
    } catch (error) {
      ui.showStatus(error.message, "error");
      ui.hideProgress();
    } finally {
      fileUploadLabel.innerHTML = originalContent;
      document.getElementById("fileInput").value = "";
    }
  },

  // 把当前转换结果下载为 .json 文件
  async downloadResult() {
    const buttonId = "downloadBtn";
    if (!state.get("currentResult")) {
      ui.showStatus("没有可下载的结果！", "error");
      return;
    }

    await ui.withButtonLoading(
      buttonId,
      async () => {
        const filename = `result_${new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:-]/g, "")}.json`;

        try {
          const blob = await apiService.downloadResult(
            state.get("currentResult"),
            filename
          );

          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", filename);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);

          ui.showStatus("文件下载成功！", "success");
        } catch (error) {
          ui.showStatus(error.message, "error");
        }
      },
      "下载中..."
    );
  },
};
