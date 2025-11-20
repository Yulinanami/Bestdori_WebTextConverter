// themeManager.js - 主题管理模块
export class ThemeManager {
  constructor() {
    this.STORAGE_KEY = "theme-preference";
    this.themeSelector = null;
    this.init();
  }

  init() {
    // 等待 DOM 加载完成
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setup());
    } else {
      this.setup();
    }
  }

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

  /**
   * 加载主题设置
   */
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

  /**
   * 设置主题并保存
   * @param {string} theme - 主题名称 ('light' 或 'dark')
   */
  setTheme(theme) {
    try {
      this.applyTheme(theme);
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch (error) {
      console.error("保存主题失败:", error);
    }
  }

  /**
   * 应用主题到 DOM
   * @param {string} theme - 主题名称
   */
  applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }
}

// 导出单例实例
export const themeManager = new ThemeManager();
