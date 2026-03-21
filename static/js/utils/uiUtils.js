// 页面 UI 小工具：提示条、按钮 loading、复制、跳转等
import { state } from "@managers/stateManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";

let statusTimer = null;
const GROUPING_STORAGE_KEY = STORAGE_KEYS.CARD_GROUPING;
const resultChunkObservers = new WeakMap();

// 把超长 JSON 切成若干静态文本块，避免单个 code 节点承载整份结果
function splitLargeResult(text, chunkSize = 24000) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(text.length, start + chunkSize);
    if (end < text.length) {
      // 尽量按换行切块，避免把一条 JSON 行从中间硬截断
      const newlineIndex = text.lastIndexOf("\n", end);
      if (newlineIndex > start + chunkSize / 2) {
        end = newlineIndex + 1;
      }
    }
    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}

// 为大结果模式准备一个独立容器，和原来的单块 code 视图分开
function ensureLargeResultHost(codeElement) {
  const container = codeElement.closest(".result-content");
  const pre = codeElement.parentElement;
  if (!container || !pre) {
    return null;
  }

  let host = container.querySelector("[data-large-result-host]");
  if (!host) {
    // 大结果单独挂到这个容器里，避免继续把整份 JSON 挤进原来的单个 code 节点
    host = document.createElement("div");
    host.dataset.largeResultHost = "true";
    host.classList.add("hidden");
    host.style.minWidth = "0";
    container.appendChild(host);
  }

  return { pre, host };
}

// 清掉旧的可视区监听，避免重复观察同一批结果块
function disconnectChunkObserver(host) {
  const observer = resultChunkObservers.get(host);
  if (!observer) {
    return;
  }
  observer.disconnect();
  resultChunkObservers.delete(host);
}

// 只对单个结果块执行一次高亮
function highlightChunk(codeElement) {
  if (!window.Prism || codeElement.dataset.highlighted === "true") {
    return;
  }
  window.Prism.highlightElement(codeElement);
  codeElement.dataset.highlighted = "true";
}

// 先高亮首屏块，其余块进入可视区后再补高亮
function observeChunkHighlights(host) {
  disconnectChunkObserver(host);
  const codeBlocks = Array.from(host.querySelectorAll("code"));
  if (!codeBlocks.length) {
    return;
  }

  // 先点亮首屏附近的块，剩下的等滚到可视区再高亮，减轻首次渲染压力
  codeBlocks.slice(0, 2).forEach(highlightChunk);
  if (!window.Prism || !window.IntersectionObserver) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        highlightChunk(entry.target);
        observer.unobserve(entry.target);
      });
    },
    {
      root: host.closest(".result-content"),
      rootMargin: "320px 0px",
    },
  );

  codeBlocks.slice(2).forEach((codeElement) => observer.observe(codeElement));
  resultChunkObservers.set(host, observer);
}

const uiUtils = {
  // 在页面右下角弹出一条提示（success/info/error）
  showStatus(message, type) {
    const statusElement = document.getElementById("statusMessage");

    if (!statusElement) return;
    clearTimeout(statusTimer);
    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    statusElement.style.display = "block";
    // 4 秒后自动隐藏提示
    statusTimer = setTimeout(() => {
      statusElement.style.display = "none";
    }, 4000);
  },

  // 把按钮切换到“加载中/正常”状态（并可替换按钮文字）
  toggleButtonLoading(buttonId, isLoading, loadingText = "处理中...") {
    const button = document.getElementById(buttonId);

    if (!button) return;
    if (isLoading && !button.dataset.originalContent) {
      button.dataset.originalContent = button.innerHTML;
    }

    if (isLoading) {
      button.disabled = true;
      button.classList.add("btn-loading");
      if (buttonId === "convertBtn") {
        const convertIcon = document.getElementById("convertIcon");
        const convertText = document.getElementById("convertText");
        if (convertIcon && convertText) {
          convertIcon.innerHTML = '<div class="loading"></div>';
          convertText.textContent = loadingText;
        }
      } else {
        const loadingIcon = '<span class="loading"></span>';
        button.innerHTML = `${loadingIcon} <span>${loadingText}</span>`;
      }
    } else {
      button.disabled = false;
      button.classList.remove("btn-loading");
      if (buttonId === "convertBtn") {
        const convertIcon = document.getElementById("convertIcon");
        const convertText = document.getElementById("convertText");
        if (convertIcon && convertText) {
          convertIcon.textContent = "";
          convertText.textContent = "开始转换";
        }
      } else if (button.dataset.originalContent) {
        button.innerHTML = button.dataset.originalContent;
        delete button.dataset.originalContent;
      }
    }
  },

  // 用 try/finally 包住异步函数：自动开/关按钮 loading
  async withButtonLoading(buttonId, asyncFn, loadingText = "处理中...") {
    this.toggleButtonLoading(buttonId, true, loadingText);
    try {
      await asyncFn();
    } finally {
      this.toggleButtonLoading(buttonId, false);
    }
  },

  // 复制文本到剪贴板（成功返回 true）
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (clipboardError) {
      console.error("复制失败:", clipboardError);
      return false;
    }
  },

  // 根据结果大小选择单块显示或静态分块显示，尽量降低长结果的页面压力
  renderResultCode(codeId, text) {
    const codeElement = document.getElementById(codeId);
    if (!codeElement) {
      return;
    }

    const resultHost = ensureLargeResultHost(codeElement);
    if (!resultHost) {
      return;
    }

    if (text.length <= 180000) {
      const { pre, host } = resultHost;
      disconnectChunkObserver(host);
      host.replaceChildren();
      host.classList.add("hidden");
      pre.classList.remove("hidden");
      codeElement.textContent = text;
      if (window.Prism) {
        window.Prism.highlightElement(codeElement);
      }
      return;
    }

    // 大结果改成静态分块展示，不在滚动时换内容，只把高亮延后到可视区
    const chunkNodes = splitLargeResult(text).map((chunkText) => {
      const chunkPre = document.createElement("pre");
      chunkPre.style.margin = "0";

      const chunkCode = document.createElement("code");
      chunkCode.className = "language-json";
      chunkCode.textContent = chunkText;
      chunkCode.dataset.highlighted = "false";

      chunkPre.appendChild(chunkCode);
      return chunkPre;
    });

    resultHost.pre.classList.add("hidden");
    codeElement.textContent = "";
    resultHost.host.replaceChildren(...chunkNodes);
    resultHost.host.classList.remove("hidden");
    observeChunkHighlights(resultHost.host);
  },

  // 一键跳转到 Bestdori 发帖页面（会先尝试把 JSON 复制到剪贴板）
  async goToBestdori() {
    if (state.currentResult) {
      const copied = await this.copyToClipboard(state.currentResult);
      if (copied) {
        this.showStatus(
          "JSON 已复制到剪贴板，正在跳转到 Bestdori...",
          "success",
        );
      }
    }
    // 稍等一下再打开 Bestdori 页面
    setTimeout(() => {
      window.open("https://bestdori.com/community/stories/new", "_blank");
    }, 500);
  },
};

// 把“卡片分组”开关状态保存到本地（下次打开仍生效）
export function initPerfSettings() {
  const checkbox = document.getElementById("groupCardsCheckbox");
  if (!checkbox) return;

  // 加载保存的设置
  const savedState = storageService.load(GROUPING_STORAGE_KEY, true);
  checkbox.checked = savedState === true || savedState === "true";

  // 监听变化
  // 切换开关时保存当前选项
  checkbox.addEventListener("change", (changeEvent) => {
    if (!storageService.save(GROUPING_STORAGE_KEY, changeEvent.target.checked)) {
      console.error("保存卡片分组设置失败");
      if (uiUtils && uiUtils.showStatus) {
        uiUtils.showStatus("无法保存设置，可能是浏览器存储空间已满。", "error");
      }
    }
  });
}

export { uiUtils, uiUtils as ui };
