// 管理文件合并页面
import { ui } from "@utils/uiUtils.js";
import { FileUtils } from "@utils/FileUtils.js";
import { apiService } from "@services/ApiService.js";

export const mergerManager = {
  mode: "bestdori", // "bestdori" or "project"
  files: [], // Array of { id, name, data }
  sortable: null,
  fileIdCounter: 0,
  mergedResultText: "",

  // 初始化
  init() {
    this.bindEvents();
    this.initSortable();
  },

  // 绑定页面事件
  bindEvents() {
    const fileUpload = document.getElementById("mergerFileUpload");
    const fileListElement = document.getElementById("mergerFileList");

    if (fileUpload) {
      // 上传区同时支持文件选择和拖拽
      document
        .getElementById("mergerFileInput")
        ?.addEventListener("change", (changeEvent) =>
          this.handleFilesUpload(changeEvent.target.files),
        );

      fileUpload.addEventListener("dragover", (dragOverEvent) => {
        dragOverEvent.preventDefault();
        fileUpload.classList.add("drag-over");
      });
      fileUpload.addEventListener("dragleave", () => {
        fileUpload.classList.remove("drag-over");
      });
      fileUpload.addEventListener("drop", (dropEvent) => {
        dropEvent.preventDefault();
        fileUpload.classList.remove("drag-over");
        if (dropEvent.dataTransfer.files.length > 0) {
          this.handleFilesUpload(dropEvent.dataTransfer.files);
        }
      });
    }

    if (fileListElement) {
      // 文件列表里的删除统一走事件委托，不再在 innerHTML 里塞内联 onclick
      fileListElement.addEventListener("click", (clickEvent) => {
        const removeButton = clickEvent.target.closest(".remove-merger-file-btn");
        if (removeButton) {
          this.removeFile(removeButton.dataset.fileId);
        }
      });
    }

    document.getElementById("mergeBtn")?.addEventListener("click", () =>
      this.mergeFiles(),
    );
    document
      .getElementById("downloadMergeBtn")
      ?.addEventListener("click", () => this.downloadMergedResult());
    document
      .getElementById("copyMergeBtn")
      ?.addEventListener("click", () => this.copyMergedResult());
    document
      .getElementById("gotoBestdoriMergeBtn")
      ?.addEventListener("click", async () => {
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
      });
  },

  // 初始化拖拽排序
  initSortable() {
    const listEl = document.getElementById("mergerFileList");
    if (listEl && window.Sortable) {
      this.sortable = new Sortable(listEl, {
        animation: 150,
        handle: ".merger-file-drag-handle",
        ghostClass: "sortable-ghost",
        // 拖完后把内部数组顺序同步回来
        onEnd: (sortableEvent) => {
          // 同步数组顺序
          const movedItem = this.files.splice(sortableEvent.oldIndex, 1)[0];
          this.files.splice(sortableEvent.newIndex, 0, movedItem);
        },
      });
    }
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
    const mergerFileInput = document.getElementById("mergerFileInput");
    if (mergerFileInput) mergerFileInput.value = "";

    this.updateUI();
  },

  // 刷新列表和按钮
  updateUI() {
    const fileListContainer = document.getElementById(
      "mergerFileListContainer",
    );
    const fileListElement = document.getElementById("mergerFileList");
    const mergeButton = document.getElementById("mergeBtn");

    if (this.files.length > 0) {
      // 有文件时重建列表 没文件时收起整个区域
      fileListContainer.classList.remove("hidden");
      mergeButton.disabled = false;

      fileListElement.innerHTML = "";
      this.files.forEach((fileEntry) => {
        const fileListItem = document.createElement("li");
        fileListItem.className = "merger-file-item";
        fileListItem.dataset.id = fileEntry.id;
        fileListItem.innerHTML = `
                <div class="merger-file-drag-handle">
                    <span class="material-symbols-outlined">drag_indicator</span>
                </div>
                <div class="merger-file-name" title="${fileEntry.name}">${fileEntry.name}</div>
                <div class="merger-file-actions">
                    <span class="merger-file-count">${fileEntry.data.actions.length} 个动作</span>
                    <button class="btn btn-icon btn-sm remove-merger-file-btn" aria-label="删除" data-file-id="${fileEntry.id}">
                        <span class="material-symbols-outlined" style="color: var(--color-error)">delete</span>
                    </button>
                </div>
            `;
        fileListElement.appendChild(fileListItem);
      });
    } else {
      fileListContainer.classList.add("hidden");
      mergeButton.disabled = true;
    }
  },

  // 清空文件和结果
  clearFiles() {
    this.files = [];
    this.mergedResultText = "";
    this.updateUI();
    document.getElementById("mergeResultSection")?.classList.add("hidden");
    ui.renderResultCode("mergeResultContent", "");
  },

  // 删除一个文件
  removeFile(fileId) {
    this.files = this.files.filter((fileEntry) => fileEntry.id !== fileId);
    this.updateUI();
  },

  // 发起合并
  async mergeFiles() {
    if (this.files.length < 1) {
      ui.showStatus("请至少上传一个文件。", "warning");
      return;
    }

    const mergeButton = document.getElementById("mergeBtn");
    const mergeIcon = document.getElementById("mergeIcon");
    const mergeText = document.getElementById("mergeText");
    const wasDisabled = mergeButton ? mergeButton.disabled : false;

    if (mergeButton) {
      mergeButton.disabled = true;
      mergeButton.classList.add("btn-loading");
    }
    if (mergeIcon && mergeText) {
      mergeIcon.innerHTML = '<div class="loading"></div>';
      mergeText.textContent = "合成中...";
    }

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
      this._displayMergeResult(this.mergedResultText);
    } catch (error) {
      if (error.message.includes("每个文件必须是同类文件")) {
        this.clearFiles();
      }
      ui.showStatus(`合并失败: ${error.message}`, "error");
    } finally {
      if (mergeButton) {
        mergeButton.classList.remove("btn-loading");
        mergeButton.disabled = wasDisabled || this.files.length < 1;
      }
      if (mergeIcon && mergeText) {
        mergeIcon.textContent = "";
        mergeText.textContent = "合成文件";
      }
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

  // 显示合并结果
  _displayMergeResult(jsonText) {
    const resultSec = document.getElementById("mergeResultSection");

    // 按模式切按钮
    const copyButton = document.getElementById("copyMergeBtn");
    const gotoButton = document.getElementById("gotoBestdoriMergeBtn");
    if (this.mode === "project") {
      if (copyButton) copyButton.classList.remove("hidden");
      if (gotoButton) gotoButton.classList.add("hidden");
    } else {
      if (copyButton) copyButton.classList.add("hidden");
      if (gotoButton) gotoButton.classList.remove("hidden");
    }

    if (resultSec) {
      resultSec.classList.remove("hidden");
      ui.renderResultCode("mergeResultContent", jsonText);
      ui.showStatus("文件合成成功！", "success");
    }
  },
};
