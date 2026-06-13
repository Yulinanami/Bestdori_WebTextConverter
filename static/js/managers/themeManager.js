// 切换浅色和深色主题数据管理（仅保留纯数据及缓存读写，拆离了渲染层）
import { themeView } from "@views/themeView.js";

export class ThemeManager {
  constructor() {
    this.STORAGE_KEY = "theme-preference";
    this.init();
  }

  // 初始化：委托给视图层
  init() {
    themeView.init(this);
  }

  // 从 localStorage 读取主题，并应用
  loadTheme() {
    try {
      const savedTheme = localStorage.getItem(this.STORAGE_KEY) || "light";
      themeView.applyTheme(savedTheme);
      themeView.setSelectorValue(savedTheme);
    } catch (error) {
      console.error("加载主题失败:", error);
      themeView.applyTheme("light");
    }
  }

  // 切换主题，并保存到 localStorage
  changeTheme(theme) {
    try {
      themeView.applyTheme(theme);
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch (error) {
      console.error("保存主题失败:", error);
    }
  }
}

// 导出单例
export const themeManager = new ThemeManager();

