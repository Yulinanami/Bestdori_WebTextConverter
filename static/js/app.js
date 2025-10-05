// 主应用入口文件
import { state } from "./stateManager.js";
import {
  ui,
  initGlobalModalListeners,
  initializeModalCloseButtons,
  initPerformanceSettingsPersistence,
} from "./uiUtils.js";
import { viewManager } from "./viewManager.js";
import { fileHandler } from "./fileHandler.js";
import { configManager } from "./configManager.js";
import { converter } from "./converter.js";
import { quoteManager } from "./quoteManager.js";
import { costumeManager } from "./costumeManager.js";
import { positionManager } from "./positionManager.js";
import { speakerEditor } from "./speakerEditor.js";
import { live2dEditor } from "./live2dEditor.js";
import { expressionEditor } from "./expressionEditor.js";
import { motionExpressionEditor } from "./motionExpressionEditor.js";
import { pinnedCharacterManager } from "./pinnedCharacterManager.js";
import { modalService } from "./services/ModalService.js";
import { eventBus } from "./services/EventBus.js";

// 初始化应用
function initializeApp() {
  // 初始化服务层
  modalService.init();
  eventBus.setDebug(false); // 生产环境设置为 false

  // 绑定经典视图事件
  bindClassicViewEvents();

  // 绑定模态框事件
  bindModalEvents();

  // 初始化性能设置的持久化功能
  initPerformanceSettingsPersistence();

  // 初始化状态
  motionExpressionEditor.init();

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

  // 初始化文件拖拽
  fileHandler.setupFileDragDrop();

  // 加载配置
  configManager.init();
  configManager.loadConfig();

  // 加载服装配置
  costumeManager.loadCostumeConfig();

  // 初始化全局模态框监听器
  initGlobalModalListeners();

  console.log("应用初始化完成");
}
// 绑定经典视图事件
function bindClassicViewEvents() {
  // 文件相关
  document
    .getElementById("fileInput")
    .addEventListener("change", fileHandler.handleFileUpload.bind(fileHandler));
  document
    .getElementById("downloadBtn")
    .addEventListener("click", fileHandler.downloadResult.bind(fileHandler));

  // 转换相关
  document
    .getElementById("convertBtn")
    .addEventListener("click", converter.convertText.bind(converter));
  document
    .getElementById("formatTextBtn")
    .addEventListener("click", viewManager.formatText.bind(viewManager));

  // 配置相关
  document
    .getElementById("configBtn")
    .addEventListener(
      "click",
      configManager.openConfigModal.bind(configManager)
    );
  document
    .getElementById("addConfigBtn")
    .addEventListener("click", configManager.addConfigItem.bind(configManager));
  document
    .getElementById("saveConfigBtn")
    .addEventListener("click", configManager.saveConfig.bind(configManager));

  // Bestdori 跳转按钮事件
  document.getElementById("gotoBestdoriBtn").addEventListener("click", () => {
    ui.goToBestdori();
  });

  // 重置配置按钮
  const resetBtn = document.getElementById("resetConfigBtn");
  if (resetBtn) {
    resetBtn.addEventListener(
      "click",
      configManager.resetConfig.bind(configManager)
    );
  }

  // 导出配置按钮
  const exportBtn = document.getElementById("exportConfigBtn");
  if (exportBtn) {
    exportBtn.addEventListener(
      "click",
      configManager.exportConfig.bind(configManager)
    );
  }

  // 导入配置按钮
  const importBtn = document.getElementById("importConfigBtn");
  if (importBtn) {
    importBtn.addEventListener("click", () => {
      document.getElementById("importConfigInput").click();
    });
  }

  // 导入配置文件选择
  const importInput = document.getElementById("importConfigInput");
  if (importInput) {
    importInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        configManager.importConfig(file);
        e.target.value = "";
      }
    });
  }

  // 清除缓存按钮
  const clearCacheBtn = document.getElementById("clearCacheBtn");
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener(
      "click",
      configManager.clearLocalStorage.bind(configManager)
    );
  }

  // 位置配置按钮
  const positionConfigBtn = document.getElementById("positionConfigBtn");
  if (positionConfigBtn) {
    positionConfigBtn.addEventListener("click", () => {
      positionManager.openPositionModal();
    });
  }

  // 服装配置按钮
  const costumeConfigBtn = document.getElementById("costumeConfigBtn");
  if (costumeConfigBtn) {
    costumeConfigBtn.addEventListener(
      "click",
      costumeManager.openCostumeModal.bind(costumeManager)
    );
  }

  // 保存服装配置按钮
  const saveCostumesBtn = document.getElementById("saveCostumesBtn");
  if (saveCostumesBtn) {
    saveCostumesBtn.addEventListener(
      "click",
      costumeManager.saveCostumes.bind(costumeManager)
    );
  }

  // 重置服装按钮
  const resetCostumesBtn = document.getElementById("resetCostumesBtn");
  if (resetCostumesBtn) {
    resetCostumesBtn.addEventListener(
      "click",
      costumeManager.resetCostumes.bind(costumeManager)
    );
  }

  // 引号相关
  document
    .getElementById("addCustomQuoteBtn")
    .addEventListener(
      "click",
      quoteManager.addCustomQuoteOption.bind(quoteManager)
    );

  // 帮助
  document
    .getElementById("helpBtn")
    .addEventListener("click", () => ui.openModal("helpModal"));

  document.getElementById("inputText").addEventListener("input", (e) => {
    if (state.get("projectFile")) {
      console.log("Input text changed, resetting project file state.");
      state.set("projectFile", null);
    }
  });
}

// 绑定模态框事件
function bindModalEvents() {
  initializeModalCloseButtons();
}

// DOM加载完成后初始化应用
document.addEventListener("DOMContentLoaded", initializeApp);
