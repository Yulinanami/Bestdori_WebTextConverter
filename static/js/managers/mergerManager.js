import { ui } from "@utils/uiUtils.js";
import { DataUtils } from "@utils/DataUtils.js";

function getTimestamp() {
  return Date.now() + Math.floor(Math.random() * 10000);
}

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
          // Update internal array
          const movedItem = this.files.splice(evt.oldIndex, 1)[0];
          this.files.splice(evt.newIndex, 0, movedItem);
        },
      });
    }
  },

  async handleFilesUpload(fileList) {
    if (!fileList || fileList.length === 0) return;

    // Read and parse each file
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.name.endsWith(".json")) {
        ui.showStatus(`文件 ${file.name} 不是 JSON 格式。`, "warning");
        continue;
      }

      try {
        const content = await this.readFileAsText(file);
        const data = JSON.parse(content);

        // Basic validation
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

    // reset input so same files can be selected again
    const input = document.getElementById("mergerFileInput");
    if (input) input.value = "";

    this.updateUI();
  },

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
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

      // Setup delete event listener globally once
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

  mergeFiles() {
    if (this.files.length < 1) {
      ui.showStatus("请至少上传一个文件。", "warning");
      return;
    }

    let mergedData = {};
    const baseData = this.files[0].data;

    // Type checking
    const isFirstProject = !!baseData.version;
    let allSameType = true;
    for (let i = 1; i < this.files.length; i++) {
      const isProject = !!this.files[i].data.version;
      if (isProject !== isFirstProject) {
        allSameType = false;
        break;
      }
    }

    if (!allSameType) {
      this.clearFiles();
      ui.showStatus(
        "合并取消：每个文件必须是同类文件（要么全是转换结果文件，要么全是进度文件）。",
        "error",
      );
      return;
    }

    this.mode = isFirstProject ? "project" : "bestdori";

    if (this.mode === "bestdori") {
      // Merge as Bestdori JSON
      mergedData = {
        server: baseData.server ?? 0,
        voice: baseData.voice ?? "",
        background: baseData.background ?? null,
        bgm: baseData.bgm ?? null,
        actions: [],
      };

      this.files.forEach((file) => {
        mergedData.actions = mergedData.actions.concat(file.data.actions || []);
      });
    } else {
      // Merge as Project File
      mergedData = {
        version: baseData.version ?? "1.0",
        projectName: baseData.projectName ?? "Merged_Project",
        globalSettings: baseData.globalSettings ?? {},
        actions: [],
      };

      this.files.forEach((file) => {
        const fileActions = file.data.actions || [];
        // Deep clone to avoid mutating original
        const clonedActions = JSON.parse(JSON.stringify(fileActions));

        // Regenerate IDs
        clonedActions.forEach((action, index) => {
          const timestamp = getTimestamp() + index;
          if (action.type === "talk") {
            action.id = `action-id-${timestamp}-${index}`;
          } else if (action.type === "layout") {
            const charId = action.characterId || 0;
            action.id = `layout-action-${timestamp}-${charId}-${index}`;
          } else {
            action.id = `action-${timestamp}-${index}`;
          }
        });

        mergedData.actions = mergedData.actions.concat(clonedActions);
      });
    }

    this.mergedResult = mergedData;

    // Show result
    const resultSec = document.getElementById("mergeResultSection");
    const resultContent = document.getElementById("mergeResultContent");
    const jsonStr = JSON.stringify(mergedData, null, 2);

    // Toggle action buttons based on mode
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
      // Apply syntax highlight if Prism is available
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
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const filename =
      this.mode === "bestdori"
        ? `merged_bestdori_${Date.now()}.json`
        : `merged_project_${Date.now()}.json`;

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
