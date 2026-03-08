// 切换浅色和深色主题
export class ThemeManager {
  constructor() {
    // 保存存储 key 并立即初始化
    this.STORAGE_KEY = "theme-preference";
    this.themeSelector = null;
    this.init();
  }

  // 初始化：等 DOM 就绪后再去找下拉框并绑定事件
  init() {
    // 等待 DOM 加载完成
    if (document.readyState === "loading") {
      // 等页面加载完再找主题下拉框
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

    // 读取已保存的主题
    this.loadTheme();

    // 监听主题切换事件
    // 切换下拉框时立即换主题
    this.themeSelector.addEventListener("change", (changeEvent) => {
      this.changeTheme(changeEvent.target.value);
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
  changeTheme(theme) {
    try {
      this.applyTheme(theme);
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch (error) {
      console.error("保存主题失败:", error);
    }
  }

  // 把主题写到 DOM
  applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }
}

// 导出单例
export const themeManager = new ThemeManager();
