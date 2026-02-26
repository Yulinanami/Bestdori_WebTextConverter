import { ui } from "@utils/uiUtils.js";
import { FileUtils } from "@utils/FileUtils.js";
import { apiService } from "@services/ApiService.js";

export const mergerManager = {
  mode: "bestdori", // "bestdori" or "project"
  files: [], // Array of { id, name, data }
  sortable: null,
  fileIdCounter: 0,
  mergedResult: null,

  // 初始化合并模块：绑定事件并启用拖拽排序。
  init() {
    this.bindEvents();
    this.initSortable();
  },

  // 绑定上传、合并、下载、复制等按钮事件。
  bindEvents() {
    const fileInput = document.getElementById("mergerFileInput");
    const fileUpload = document.getElementById("mergerFileUpload");

    if (fileInput && fileUpload) {
      fileInput.addEventListener("change", (changeEvent) =>
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

    const mergeButton = document.getElementById("mergeBtn");
    if (mergeButton) {
      mergeButton.addEventListener("click", () => this.mergeFiles());
    }

    const downloadMergeButton = document.getElementById("downloadMergeBtn");
    if (downloadMergeButton) {
      downloadMergeButton.addEventListener("click", () =>
        this.downloadMergedResult(),
      );
    }

    const copyMergeButton = document.getElementById("copyMergeBtn");
    if (copyMergeButton) {
      copyMergeButton.addEventListener("click", () => this.copyMergedResult());
    }

    const gotoMergeButton = document.getElementById("gotoBestdoriMergeBtn");
    if (gotoMergeButton) {
      gotoMergeButton.addEventListener("click", async () => {
        if (!this.mergedResult) return;
        const mergedJsonText = JSON.stringify(this.mergedResult, null, 2);
        try {
          await navigator.clipboard.writeText(mergedJsonText);
          ui.showStatus("合并结果已复制，正在跳转到 Bestdori...", "success");
        } catch {
          ui.showStatus("复制失败，请手动选择复制后跳转。", "warning");
        }
        setTimeout(() => {
          window.open("https://bestdori.com/community/stories/new", "_blank");
        }, 500);
      });
    }
  },

  // 初始化文件列表排序（拖拽后同步内部数组顺序）。
  initSortable() {
    const listEl = document.getElementById("mergerFileList");
    if (listEl && window.Sortable) {
      this.sortable = new Sortable(listEl, {
        animation: 150,
        handle: ".merger-file-drag-handle",
        ghostClass: "sortable-ghost",
        onEnd: (sortableEvent) => {
          // 同步内部数组顺序
          const movedItem = this.files.splice(sortableEvent.oldIndex, 1)[0];
          this.files.splice(sortableEvent.newIndex, 0, movedItem);
        },
      });
    }
  },

  // 批量导入待合并文件：前端只上传，解析与校验由后端完成。
  async handleFilesUpload(fileList) {
    if (!fileList || fileList.length === 0) return;

    // 逐个上传到后端解析
    for (const file of Array.from(fileList)) {
      try {
        const response = await apiService.importMergeFile(file);
        const parsedFile = response.file;

        this.files.push({
          id: `merger-file-${this.fileIdCounter++}`,
          name: parsedFile.name,
          data: parsedFile.data,
        });
      } catch (error) {
        ui.showStatus(error.message, "error");
      }
    }

    // 重置 input 以便再次选择相同文件
    const mergerFileInput = document.getElementById("mergerFileInput");
    if (mergerFileInput) mergerFileInput.value = "";

    this.updateUI();
  },

  // 刷新文件列表展示和“合并”按钮状态。
  updateUI() {
    const fileListContainer = document.getElementById(
      "mergerFileListContainer",
    );
    const fileListElement = document.getElementById("mergerFileList");
    const mergeButton = document.getElementById("mergeBtn");

    if (this.files.length > 0) {
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
                    <button class="btn btn-icon btn-sm" aria-label="删除" onclick="document.dispatchEvent(new CustomEvent('remove-merger-file', {detail: '${fileEntry.id}'}))">
                        <span class="material-symbols-outlined" style="color: var(--color-error)">delete</span>
                    </button>
                </div>
            `;
        fileListElement.appendChild(fileListItem);
      });

      // 只绑定一次全局删除事件
      if (!this._isDeleteEventBound) {
        document.addEventListener("remove-merger-file", (removeFileEvent) => {
          this.removeFile(removeFileEvent.detail);
        });
        this._isDeleteEventBound = true;
      }
    } else {
      fileListContainer.classList.add("hidden");
      mergeButton.disabled = true;
    }
  },

  // 清空待合并文件和合并结果展示区域。
  clearFiles() {
    this.files = [];
    this.updateUI();
    const resultSec = document.getElementById("mergeResultSection");
    if (resultSec) resultSec.classList.add("hidden");
  },

  // 删除指定文件并刷新列表。
  removeFile(fileId) {
    this.files = this.files.filter((fileEntry) => fileEntry.id !== fileId);
    this.updateUI();
  },

  // 合并文件：后端负责类型验证和实际合并
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

    // 调用后端 API 执行合并
    try {
      const filesPayload = this.files.map((fileEntry) => ({
        name: fileEntry.name,
        data: fileEntry.data,
      }));

      const response = await apiService.mergeFiles(filesPayload);
      this.mergedResult = response.result;
      this.mode = response.mode || "bestdori";
      this._displayMergeResult(this.mergedResult);
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

  // 下载合并结果（统一走后端下载接口）。
  async downloadMergedResult() {
    if (!this.mergedResult) return;

    const mergedJsonText = JSON.stringify(this.mergedResult, null, 2);
    const filename =
      this.mode === "bestdori"
        ? `merged_bestdori_${Date.now()}.json`
        : `merged_project_${Date.now()}.json`;

    try {
      const downloadBlob = await apiService.downloadResult(
        mergedJsonText,
        filename,
      );
      FileUtils.downloadAsFile(downloadBlob, filename);
      ui.showStatus("下载成功！", "success");
    } catch (error) {
      ui.showStatus(`下载失败: ${error.message}`, "error");
    }
  },

  // 复制合并结果 JSON 到剪贴板。
  async copyMergedResult() {
    if (!this.mergedResult) return;
    const mergedJsonText = JSON.stringify(this.mergedResult, null, 2);
    try {
      await navigator.clipboard.writeText(mergedJsonText);
      ui.showStatus("合并结果已复制到剪贴板！", "success");
    } catch {
      ui.showStatus("复制失败，请手动选择复制。", "error");
    }
  },

  // 内部方法：展示合并结果
  _displayMergeResult(mergedData) {
    const resultSec = document.getElementById("mergeResultSection");
    const resultContent = document.getElementById("mergeResultContent");
    const jsonStr = JSON.stringify(mergedData, null, 2);

    // 根据模式切换操作按钮
    const copyButton = document.getElementById("copyMergeBtn");
    const gotoButton = document.getElementById("gotoBestdoriMergeBtn");
    if (this.mode === "project") {
      if (copyButton) copyButton.classList.remove("hidden");
      if (gotoButton) gotoButton.classList.add("hidden");
    } else {
      if (copyButton) copyButton.classList.add("hidden");
      if (gotoButton) gotoButton.classList.remove("hidden");
    }

    if (resultSec && resultContent) {
      resultContent.textContent = jsonStr;
      if (window.Prism) {
        window.Prism.highlightElement(resultContent);
      }
      resultSec.classList.remove("hidden");
      resultSec.scrollIntoView({ behavior: "smooth", block: "start" });
      ui.showStatus("文件合成成功！", "success");
    }
  },
};
