// 启动页面并绑定全局事件
import { state } from "@managers/stateManager.js";
import { ui, initPerfSettings } from "@utils/uiUtils.js";
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
import { motionExprManager } from "@managers/motionExprManager.js";
import { pinnedCharacterManager } from "@managers/pinnedCharacterManager.js";
import { mergerManager } from "@managers/mergerManager.js";
import { docsManager } from "@managers/docsManager.js";
import { modalService } from "@services/ModalService.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import "@managers/navigationManager.js"; // 初始化导航
import "@managers/themeManager.js"; // 初始化主题

const savedInputs = [
  {
    inputElementId: "appendSpaces",
    storageKey: STORAGE_KEYS.AUTO_APPEND_SPACES,
  },
  {
    inputElementId: "appendSpacesBeforeNewline",
    storageKey: STORAGE_KEYS.AUTO_APPEND_SPACES_BEFORE_NEWLINE,
  },
];

const initJobs = [
  // 初始化动作表情设置
  () => motionExprManager.init(),
  // 初始化动作表情编辑器
  () => expressionEditor.init(),
  // 初始化对话编辑器
  () => speakerEditor.init(),
  // 初始化 Live2D 编辑器
  () => live2dEditor.init(),
  // 读取置顶角色
  () => pinnedCharacterManager.load(),
  // 初始化位置设置
  () => positionManager.init(),
  // 初始化服装设置
  () => costumeManager.init(),
  // 初始化文件处理
  () => fileHandler.init(),
  // 初始化转换功能
  () => converter.init(),
  // 初始化页面功能
  () => viewManager.init(),
  // 初始化引号设置
  () => quoteManager.init(),
  // 初始化合并功能
  () => mergerManager.init(),
  // 初始化角色设置
  () => configManager.init(),
];

// 初始化会自动保存的数字输入框
const initNumInput = ({ inputElementId, storageKey }) => {
  const numericInput = document.getElementById(inputElementId);
  if (!numericInput) return;

  numericInput.value = storageService.load(storageKey, 0);

  // 输入变化时立即保存
  numericInput.addEventListener("input", (inputEvent) => {
    storageService.save(storageKey, parseInt(inputEvent.target.value) || 0);
  });
};

// 按顺序启动页面功能
const initApp = async () => {
  modalService.init();
  // 存满时提醒用户清缓存
  storageService.onQuotaExceeded = (key, size) => {
    ui.showStatus(
      `存储空间已满（当前：${size}）！请导出配置后点击"清除缓存"按钮清理数据，或删除浏览器中其他网站的数据。`,
      "error",
      8000,
    );
  };

  bindGlobalEvents();
  initPerfSettings();
  savedInputs.forEach(initNumInput);
  initJobs.forEach((run) => run());
  await configManager.loadConfig();
  await costumeManager.loadConfig();
};
// 绑定全局按钮和输入框事件
const bindGlobalEvents = () => {
  document
    .getElementById("gotoBestdoriBtn")
    // 打开 Bestdori
    ?.addEventListener("click", () => ui.goToBestdori());

  document.getElementById("inputText")?.addEventListener("input", () => {
    if (state.projectFile) {
      state.projectFile = null;
    }
  });

  // 切换移动端侧边栏
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebarOverlay = document.getElementById("sidebarOverlay");

  // 打开或收起手机侧边栏
  const toggleSidebar = () => {
    const sidebar = document
      .querySelector(".app-container:not(.hidden)")
      ?.querySelector(".app-sidebar");
    sidebar?.classList.toggle("active");
    sidebarOverlay?.classList.toggle(
      "active",
      sidebar?.classList.contains("active"),
    );
  };

  // 关掉手机侧边栏和遮罩
  const closeSidebar = () => {
    document.querySelectorAll(".app-sidebar.active").forEach((sidebar) => {
      sidebar.classList.remove("active");
    });
    sidebarOverlay?.classList.remove("active");
  };

  docsManager.init(closeSidebar);

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", toggleSidebar);
    sidebarOverlay?.addEventListener("click", closeSidebar);

    // 手机上点导航后收起侧边栏
    document.querySelectorAll(".nav-step").forEach((step) => {
      // 点击导航项后按需收起侧边栏
      step.addEventListener("click", () => {
        if (window.innerWidth <= 768) closeSidebar();
      });
    });
  }
};

// 页面加载完成后启动应用
document.addEventListener("DOMContentLoaded", () => {
  void initApp();
});
