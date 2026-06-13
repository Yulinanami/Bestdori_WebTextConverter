// 切换浅色和深色主题界面渲染管理
export const themeView = {
  manager: null,
  themeSelector: null,

  // 初始化并绑定事件
  init(manager) {
    this.manager = manager;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setup());
    } else {
      this.setup();
    }
  },

  setup() {
    this.themeSelector = document.getElementById("themeSelector");
    if (!this.themeSelector) {
      console.warn("主题选择器未找到");
      return;
    }

    this.manager.loadTheme();

    this.themeSelector.addEventListener("change", (changeEvent) => {
      this.manager.changeTheme(changeEvent.target.value);
    });
  },

  // 设置下拉选择框的值
  setSelectorValue(theme) {
    if (this.themeSelector) {
      this.themeSelector.value = theme;
    }
  },

  // 将主题应用到网页根节点上
  applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  },
};
