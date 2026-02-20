// 应用入口：页面加载完成后，初始化各个模块并绑定事件
import { state } from "@managers/stateManager.js";
import { ui, initPerformanceSettingsPersistence } from "@utils/uiUtils.js";
import { viewManager } from "@managers/viewManager.js";
import { fileHandler } from "@managers/fileHandler.js";
import { configManager } from "@managers/configManager.js";
import { converter } from "@managers/converter.js";
import { quoteManager } from "@managers/quoteManager.js";
import { costumeManager } from "@managers/costumeManager.js";
import { positionManager } from "@managers/positionManager.js";
import { speakerEditor } from "@editors/speaker/speakerEditor.js";
import { live2dEditor } from "@editors/live2d/live2dEditor.js";
import { expressionEditor } from "@editors/expression/expressionEditor.js";
import { motionExpressionManager } from "@managers/motionExpressionManager.js";
import { pinnedCharacterManager } from "@managers/pinnedCharacterManager.js";
import { mergerManager } from "@managers/mergerManager.js";
import { modalService } from "@services/ModalService.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { apiService } from "@services/ApiService.js";
import "@managers/navigationManager.js"; // 初始化导航
import "@managers/themeManager.js"; // 初始化主题

// 让一个数字输入框“自动保存到本地”，下次打开还能记住
const initializeNumericInput = ({ elementId, storageKey }) => {
  const input = document.getElementById(elementId);
  if (!input) return;

  const savedValue = storageService.get(storageKey, 0);
  input.value = savedValue;

  input.addEventListener("input", (e) => {
    const value = parseInt(e.target.value, 10) || 0;
    storageService.set(storageKey, value);
  });
};

// 初始化整个应用（按顺序启动各模块）
const initializeApp = () => {
  // 初始化服务层
  modalService.init();

  // 设置 LocalStorage 配额超限错误处理
  storageService.onQuotaExceeded = (key, size) => {
    ui.showStatus(
      `存储空间已满（当前：${size}）！请导出配置后点击"清除缓存"按钮清理数据，或删除浏览器中其他网站的数据。`,
      "error",
      8000,
    );
  };

  // 绑定全局事件
  bindGlobalEvents();

  // 初始化性能设置的持久化功能
  initPerformanceSettingsPersistence();
  initializeNumericInput({
    elementId: "appendSpaces",
    storageKey: STORAGE_KEYS.AUTO_APPEND_SPACES,
  });
  initializeNumericInput({
    elementId: "appendSpacesBeforeNewline",
    storageKey: STORAGE_KEYS.AUTO_APPEND_SPACES_BEFORE_NEWLINE,
  });

  // 初始化状态
  motionExpressionManager.init();

  // 初始化动作表情管理器
  expressionEditor.init();

  // 初始化说话人编辑器
  speakerEditor.init();

  // 初始化 Live2D 编辑器
  live2dEditor.init();

  // 加载已置顶的角色配置
  pinnedCharacterManager.load();

  // 初始化位置管理器
  positionManager.init();

  // 初始化服装事件委托
  costumeManager.init();

  // 初始化文件处理
  fileHandler.init();

  // 初始化转换器事件
  converter.init();

  // 初始化文本视图操作
  viewManager.init();

  // 初始化引号相关按钮
  quoteManager.init();

  // 初始化文件合成器
  mergerManager.init();

  // 加载配置
  configManager.init();
  configManager.loadConfig();

  // 加载服装配置
  costumeManager.loadCostumeConfig();
};
// 绑定“全局按钮/输入框”的事件（不属于某个具体模块的那种）
const bindGlobalEvents = () => {
  document
    .getElementById("gotoBestdoriBtn")
    ?.addEventListener("click", () => ui.goToBestdori());
  document
    .getElementById("helpBtn")
    ?.addEventListener("click", () => ui.openModal("helpModal"));

  document.getElementById("shutdownBtn")?.addEventListener("click", () => {
    if (confirm("确定要关闭应用程序吗？")) {
      ui.showStatus("正在关闭服务器...", "info");
      apiService.shutdownServer();
      setTimeout(() => {
        document.body.innerHTML = `
          <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; text-align: center; background: var(--secondary-gradient); color: var(--text-primary);">
            <div>
              <h1 style="font-size: 2rem; margin-bottom: 1rem;">程序已关闭</h1>
              <p style="font-size: 1.1rem; color: var(--text-secondary);">你现在可以安全地关闭此浏览器窗口了。</p>
            </div>
          </div>
        `;
      }, 500);
    }
  });

  document.getElementById("inputText")?.addEventListener("input", () => {
    if (state.get("projectFile")) {
      state.set("projectFile", null);
    }
  });

  // 移动端侧边栏切换逻辑
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebar = document.querySelector(".app-sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  const toggleSidebar = () => {
    sidebar?.classList.toggle("active");
    sidebarOverlay?.classList.toggle("active");
  };

  const closeSidebar = () => {
    sidebar?.classList.remove("active");
    sidebarOverlay?.classList.remove("active");
  };

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", toggleSidebar);
    sidebarOverlay?.addEventListener("click", closeSidebar);

    document.querySelectorAll(".nav-step").forEach((step) => {
      step.addEventListener("click", () => {
        if (window.innerWidth <= 768) closeSidebar();
      });
    });
  }
};

// DOM加载完成后初始化应用
document.addEventListener("DOMContentLoaded", initializeApp);
