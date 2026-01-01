// 管理浅色/深色主题：读取本地保存的选择，并把主题应用到页面上
export class ThemeManager {
  constructor() {
    // 初始化：定义存储 key，并立刻启动初始化流程
    this.STORAGE_KEY = "theme-preference";
    this.themeSelector = null;
    this.init();
  }

  // 初始化：等 DOM 就绪后再去找下拉框并绑定事件
  init() {
    // 等待 DOM 加载完成
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setup());
    } else {
      this.setup();
    }
  }

  // 绑定主题选择器，并加载之前保存的主题
  setup() {
    this.themeSelector = document.getElementById("themeSelector");
    if (!this.themeSelector) {
      console.warn("主题选择器未找到");
      return;
    }

    // 加载保存的主题偏好
    this.loadTheme();

    // 监听主题切换事件
    this.themeSelector.addEventListener("change", (e) => {
      this.setTheme(e.target.value);
    });
  }

  // 从 localStorage 读取主题，并应用到页面
  loadTheme() {
    try {
      const savedTheme = localStorage.getItem(this.STORAGE_KEY) || "light";
      this.applyTheme(savedTheme);
      if (this.themeSelector) {
        this.themeSelector.value = savedTheme;
      }
    } catch (error) {
      console.error("加载主题失败:", error);
      this.applyTheme("light");
    }
  }

  // 切换主题，并把选择保存到 localStorage
  setTheme(theme) {
    try {
      this.applyTheme(theme);
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch (error) {
      console.error("保存主题失败:", error);
    }
  }

  // 真正把主题写到 DOM（通过 data-theme 控制 CSS）
  applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }
}

// 导出单例（导入即自动初始化）
export const themeManager = new ThemeManager();
