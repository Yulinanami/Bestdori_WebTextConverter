import { ui } from "@utils/uiUtils.js";
import { FileUtils } from "@utils/FileUtils.js";
import { apiService } from "@services/ApiService.js";

export const mergerManager = {
  mode: "bestdori", // "bestdori" or "project"
  files: [], // Array of { id, name, data }
  sortable: null,
  fileIdCounter: 0,
  mergedResult: null,

  init() {
    this.bindEvents();
    this.initSortable();
  },

  bindEvents() {
    const fileInput = document.getElementById("mergerFileInput");
    const fileUpload = document.getElementById("mergerFileUpload");

    if (fileInput && fileUpload) {
      fileInput.addEventListener("change", (e) =>
        this.handleFilesUpload(e.target.files),
      );

      fileUpload.addEventListener("dragover", (e) => {
        e.preventDefault();
        fileUpload.classList.add("drag-over");
      });
      fileUpload.addEventListener("dragleave", () => {
        fileUpload.classList.remove("drag-over");
      });
      fileUpload.addEventListener("drop", (e) => {
        e.preventDefault();
        fileUpload.classList.remove("drag-over");
        if (e.dataTransfer.files.length > 0) {
          this.handleFilesUpload(e.dataTransfer.files);
        }
      });
    }

    const mergeBtn = document.getElementById("mergeBtn");
    if (mergeBtn) {
      mergeBtn.addEventListener("click", () => this.mergeFiles());
    }

    const downloadMergeBtn = document.getElementById("downloadMergeBtn");
    if (downloadMergeBtn) {
      downloadMergeBtn.addEventListener("click", () =>
        this.downloadMergedResult(),
      );
    }

    const copyMergeBtn = document.getElementById("copyMergeBtn");
    if (copyMergeBtn) {
      copyMergeBtn.addEventListener("click", () => this.copyMergedResult());
    }

    const gotoMergeBtn = document.getElementById("gotoBestdoriMergeBtn");
    if (gotoMergeBtn) {
      gotoMergeBtn.addEventListener("click", async () => {
        if (!this.mergedResult) return;
        const dataStr = JSON.stringify(this.mergedResult, null, 2);
        try {
          await navigator.clipboard.writeText(dataStr);
          ui.showStatus("合并结果已复制，正在跳转到 Bestdori...", "success");
        } catch (err) {
          ui.showStatus("复制失败，请手动选择复制后跳转。", "warning");
        }
        setTimeout(() => {
          window.open("https://bestdori.com/community/stories/new", "_blank");
        }, 500);
      });
    }
  },

  initSortable() {
    const listEl = document.getElementById("mergerFileList");
    if (listEl && window.Sortable) {
      this.sortable = new Sortable(listEl, {
        animation: 150,
        handle: ".merger-file-drag-handle",
        ghostClass: "sortable-ghost",
        onEnd: (evt) => {
          // 同步内部数组顺序
          const movedItem = this.files.splice(evt.oldIndex, 1)[0];
          this.files.splice(evt.newIndex, 0, movedItem);
        },
      });
    }
  },

  async handleFilesUpload(fileList) {
    if (!fileList || fileList.length === 0) return;

    // 逐个读取并解析文件
    for (const file of Array.from(fileList)) {
      if (!file.name.endsWith(".json")) {
        ui.showStatus(`文件 ${file.name} 不是 JSON 格式。`, "warning");
        continue;
      }

      try {
        const content = await this.readFileAsText(file);
        const data = JSON.parse(content);

        // 基本校验
        if (!data.actions || !Array.isArray(data.actions)) {
          ui.showStatus(
            `文件 ${file.name} 格式不正确，缺少 actions 数组。`,
            "error",
          );
          continue;
        }

        this.files.push({
          id: `merger-file-${this.fileIdCounter++}`,
          name: file.name,
          data: data,
        });
      } catch (e) {
        ui.showStatus(`解析 ${file.name} 失败: ${e.message}`, "error");
      }
    }

    // 重置 input 以便再次选择相同文件
    const input = document.getElementById("mergerFileInput");
    if (input) input.value = "";

    this.updateUI();
  },

  readFileAsText(file) {
    return FileUtils.readFileAsText(file);
  },

  clearFiles() {
    this.files = [];
    this.updateUI();
    const resultSec = document.getElementById("mergeResultSection");
    if (resultSec) resultSec.classList.add("hidden");
  },

  removeFile(id) {
    this.files = this.files.filter((f) => f.id !== id);
    this.updateUI();
  },

  updateUI() {
    const container = document.getElementById("mergerFileListContainer");
    const list = document.getElementById("mergerFileList");
    const mergeBtn = document.getElementById("mergeBtn");

    if (this.files.length > 0) {
      container.classList.remove("hidden");
      mergeBtn.disabled = false;

      list.innerHTML = "";
      this.files.forEach((file) => {
        const li = document.createElement("li");
        li.className = "merger-file-item";
        li.dataset.id = file.id;
        li.innerHTML = `
                <div class="merger-file-drag-handle">
                    <span class="material-symbols-outlined">drag_indicator</span>
                </div>
                <div class="merger-file-name" title="${file.name}">${file.name}</div>
                <div class="merger-file-actions">
                    <span class="merger-file-count">${file.data.actions.length} 个动作</span>
                    <button class="btn btn-icon btn-sm" aria-label="删除" onclick="document.dispatchEvent(new CustomEvent('remove-merger-file', {detail: '${file.id}'}))">
                        <span class="material-symbols-outlined" style="color: var(--color-error)">delete</span>
                    </button>
                </div>
            `;
        list.appendChild(li);
      });

      // 只绑定一次全局删除事件
      if (!this._deleteEventBound) {
        document.addEventListener("remove-merger-file", (e) => {
          this.removeFile(e.detail);
        });
        this._deleteEventBound = true;
      }
    } else {
      container.classList.add("hidden");
      mergeBtn.disabled = true;
    }
  },

  // 合并文件：前端负责类型验证，后端负责实际合并
  async mergeFiles() {
    if (this.files.length < 1) {
      ui.showStatus("请至少上传一个文件。", "warning");
      return;
    }

    const baseData = this.files[0].data;

    // 类型检查：确保所有文件是同一类型（保留在前端）
    const isFirstProject = !!baseData.version;
    const allSameType = this.files.slice(1).every((file) => {
      const isProject = !!file.data.version;
      return isProject === isFirstProject;
    });

    if (!allSameType) {
      this.clearFiles();
      ui.showStatus(
        "合并取消：每个文件必须是同类文件（要么全是转换结果文件，要么全是进度文件）。",
        "error",
      );
      return;
    }

    this.mode = isFirstProject ? "project" : "bestdori";

    // 调用后端 API 执行合并
    try {
      const filesPayload = this.files.map((f) => ({
        name: f.name,
        data: f.data,
      }));

      const response = await apiService.mergeFiles(this.mode, filesPayload);
      this.mergedResult = response.result;
      this._displayMergeResult(this.mergedResult);
    } catch (error) {
      ui.showStatus(`合并失败: ${error.message}`, "error");
    }
  },

  // 展示合并结果
  _displayMergeResult(mergedData) {
    const resultSec = document.getElementById("mergeResultSection");
    const resultContent = document.getElementById("mergeResultContent");
    const jsonStr = JSON.stringify(mergedData, null, 2);

    // 根据模式切换操作按钮
    const copyBtn = document.getElementById("copyMergeBtn");
    const gotoBtn = document.getElementById("gotoBestdoriMergeBtn");
    if (this.mode === "project") {
      if (copyBtn) copyBtn.classList.remove("hidden");
      if (gotoBtn) gotoBtn.classList.add("hidden");
    } else {
      if (copyBtn) copyBtn.classList.add("hidden");
      if (gotoBtn) gotoBtn.classList.remove("hidden");
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

  downloadMergedResult() {
    if (!this.mergedResult) return;

    const dataStr = JSON.stringify(this.mergedResult, null, 2);
    const filename =
      this.mode === "bestdori"
        ? `merged_bestdori_${Date.now()}.json`
        : `merged_project_${Date.now()}.json`;

    FileUtils.downloadAsFile(dataStr, filename);
  },

  async copyMergedResult() {
    if (!this.mergedResult) return;
    const dataStr = JSON.stringify(this.mergedResult, null, 2);
    try {
      await navigator.clipboard.writeText(dataStr);
      ui.showStatus("合并结果已复制到剪贴板！", "success");
    } catch (err) {
      ui.showStatus("复制失败，请手动选择复制。", "error");
    }
  },
};
