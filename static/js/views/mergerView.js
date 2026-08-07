// 文件合并渲染界面管理
import { ui } from "@utils/uiUtils.js";

export const mergerView = {
  manager: null,

  // 初始化绑定事件监听
  init(manager) {
    this.manager = manager;
    this.bindEvents();
    this.initSortable();
  },

  // 绑定页面交互事件
  bindEvents() {
    const fileUpload = document.getElementById("mergerFileUpload");
    const fileListElement = document.getElementById("mergerFileList");

    if (fileUpload) {
      // 上传区支持文件选择和拖拽
      document
        .getElementById("mergerFileInput")
        ?.addEventListener("change", (changeEvent) =>
          this.manager.handleFilesUpload(changeEvent.target.files)
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
          this.manager.handleFilesUpload(dropEvent.dataTransfer.files);
        }
      });
    }

    if (fileListElement) {
      // 文件列表中的删除操作通过事件委托处理
      fileListElement.addEventListener("click", (clickEvent) => {
        const removeButton = clickEvent.target.closest(".remove-merger-file-btn");
        if (removeButton) {
          this.manager.removeFile(removeButton.dataset.fileId);
        }
      });
    }

    document.getElementById("mergeBtn")?.addEventListener("click", () =>
      this.manager.mergeFiles()
    );
    document
      .getElementById("downloadMergeBtn")
      ?.addEventListener("click", () => this.manager.downloadMergedResult());
    document
      .getElementById("copyMergeBtn")
      ?.addEventListener("click", () => this.manager.copyMergedResult());
    document
      .getElementById("gotoBestdoriMergeBtn")
      ?.addEventListener("click", () => this.manager.gotoBestdoriMerge());
  },

  // 初始化拖拽排序组件
  initSortable() {
    const listEl = document.getElementById("mergerFileList");
    if (listEl && window.Sortable) {
      new Sortable(listEl, {
        animation: 150,
        handle: ".merger-file-drag-handle",
        ghostClass: "sortable-ghost",
        // 拖拽结束时同步数据数组
        onEnd: (sortableEvent) => {
          this.manager.reorderFiles(sortableEvent.oldIndex, sortableEvent.newIndex);
        },
      });
    }
  },

  // 清空选择框的值
  clearFileInput() {
    const mergerFileInput = document.getElementById("mergerFileInput");
    if (mergerFileInput) mergerFileInput.value = "";
  },

  // 更新已选择的文件列表与按钮状态
  updateUI() {
    const fileListContainer = document.getElementById("mergerFileListContainer");
    const fileListElement = document.getElementById("mergerFileList");
    const mergeButton = document.getElementById("mergeBtn");

    if (!fileListContainer || !fileListElement || !mergeButton) return;

    const files = this.manager.files;
    fileListElement.replaceChildren();

    if (files.length > 0) {
      fileListContainer.classList.remove("hidden");
      mergeButton.disabled = false;

      files.forEach((fileEntry) => {
        const fileListItem = document.createElement("li");
        fileListItem.className = "merger-file-item";
        fileListItem.dataset.id = fileEntry.id;
        fileListItem.innerHTML = `
          <div class="merger-file-drag-handle">
            <span class="material-symbols-outlined">drag_indicator</span>
          </div>
          <div class="merger-file-name"></div>
          <div class="merger-file-actions">
            <span class="merger-file-count"></span>
            <button type="button" class="btn btn-icon btn-sm remove-merger-file-btn" aria-label="删除">
              <span class="material-symbols-outlined" style="color: var(--color-error)">delete</span>
            </button>
          </div>
        `;

        const fileName = fileListItem.querySelector(".merger-file-name");
        fileName.textContent = fileEntry.name;
        fileName.title = fileEntry.name;
        const actionCount = fileListItem.querySelector(".merger-file-count");
        actionCount.textContent = `${fileEntry.data.actions.length} 个动作`;
        const removeButton = fileListItem.querySelector(
          ".remove-merger-file-btn",
        );
        removeButton.dataset.fileId = fileEntry.id;
        fileListElement.appendChild(fileListItem);
      });
    } else {
      fileListContainer.classList.add("hidden");
      mergeButton.disabled = true;
    }
  },

  // 清空整个合并界面的展示
  clearUI() {
    this.updateUI();
    document.getElementById("mergeResultSection")?.classList.add("hidden");
    ui.renderResultCode("mergeResultContent", "");
  },

  // 控制合并按钮的加载动画状态
  setLoading(isLoading, wasDisabled) {
    const mergeButton = document.getElementById("mergeBtn");
    const mergeIcon = document.getElementById("mergeIcon");
    const mergeText = document.getElementById("mergeText");

    if (isLoading) {
      if (mergeButton) {
        mergeButton.disabled = true;
        mergeButton.classList.add("btn-loading");
      }
      if (mergeIcon && mergeText) {
        mergeIcon.innerHTML = '<div class="loading"></div>';
        mergeText.textContent = "合成中...";
      }
    } else {
      if (mergeButton) {
        mergeButton.classList.remove("btn-loading");
        mergeButton.disabled = wasDisabled;
      }
      if (mergeIcon && mergeText) {
        mergeIcon.textContent = "";
        mergeText.textContent = "合成文件";
      }
    }
  },

  // 渲染显示合并成功后的结果
  displayMergeResult(jsonText, mode) {
    const resultSec = document.getElementById("mergeResultSection");
    const copyButton = document.getElementById("copyMergeBtn");
    const gotoButton = document.getElementById("gotoBestdoriMergeBtn");

    copyButton?.classList.toggle("hidden", mode !== "project");
    gotoButton?.classList.toggle("hidden", mode === "project");

    if (resultSec) {
      resultSec.classList.remove("hidden");
      ui.renderResultCode("mergeResultContent", jsonText);
      ui.showStatus("文件合成成功！", "success");
    }
  },
};
