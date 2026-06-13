// 文件上传与下载界面渲染管理
import { ui } from "@utils/uiUtils.js";

export const fileView = {
  manager: null,

  // 初始化并绑定事件
  init(manager) {
    this.manager = manager;

    document
      .getElementById("fileInput")
      ?.addEventListener("change", (changeEvent) => {
        const file = changeEvent.target.files[0];
        if (file) this.manager.handleFileUpload(file);
      });

    document
      .getElementById("downloadBtn")
      ?.addEventListener("click", () => this.manager.downloadResult());

    this.setupFileDragDrop();
  },

  // 启用拖拽上传区的高亮交互
  setupFileDragDrop() {
    const fileUpload = document.getElementById("fileUpload");
    if (!fileUpload) return;

    // 拦截浏览器默认拖拽行为
    const preventDefaults = (dragEvent) => {
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
    };

    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      fileUpload.addEventListener(eventName, preventDefaults, false);
    });

    // 拖入时高亮
    ["dragenter", "dragover"].forEach((eventName) => {
      fileUpload.addEventListener(
        eventName,
        () => fileUpload.classList.add("dragover"),
        false
      );
    });

    // 拖离时取消高亮
    ["dragleave", "drop"].forEach((eventName) => {
      fileUpload.addEventListener(
        eventName,
        () => fileUpload.classList.remove("dragover"),
        false
      );
    });

    // 松手时进行文件分发
    fileUpload.addEventListener(
      "drop",
      (dropEvent) => {
        if (dropEvent.dataTransfer.files.length > 0) {
          const fileInput = document.getElementById("fileInput");
          if (fileInput) {
            fileInput.files = dropEvent.dataTransfer.files;
          }
          this.manager.handleFileUpload(dropEvent.dataTransfer.files[0]);
        }
      },
      false
    );
  },

  // 清空隐藏的文件选择框的值
  clearFileInput() {
    const fileInput = document.getElementById("fileInput");
    if (fileInput) fileInput.value = "";
  },

  // 设置上传过程中的状态及加载动画呈现
  setUploadLoading(isLoading) {
    const fileUploadLabel = document.querySelector(".file-upload-label");
    if (!fileUploadLabel) return;

    if (isLoading) {
      this.originalUploadContent = fileUploadLabel.innerHTML;
      fileUploadLabel.innerHTML = `
        <div>
            <div class="loading" style="margin: 0 auto 10px; font-size: 2rem;"></div>
            <div style="font-weight: 600;">正在上传文件...</div>
            <div style="font-size: 0.9rem; color: #718096;">请稍候</div>
        </div>
      `;
    } else {
      if (this.originalUploadContent) {
        fileUploadLabel.innerHTML = this.originalUploadContent;
      }
    }
  },

  // 统一包装按钮的加载动效
  async runWithButtonLoading(buttonId, loadingText, actionAsyncFn) {
    await ui.withButtonLoading(buttonId, actionAsyncFn, loadingText);
  },
};
