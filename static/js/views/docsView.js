// 管理文档页切换和文档导航
import { instantiateTemplate } from "@utils/templateLoader.js";

export const docsView = {
  _instantiated: false,

  // 绑定文档页按钮和导航
  init(closeSidebar) {
    this.mainPage = document.getElementById("mainAppPage");
    this.docsPage = document.getElementById("docsPage");
    this.helpButton = document.getElementById("helpBtn");
    this.closeSidebar = closeSidebar;

    this.syncHelpButton(false);
    this.helpButton.addEventListener("click", () => {
      this._ensureInstantiated();
      if (this.docsPage.classList.contains("hidden")) {
        this.open("overview");
        return;
      }
      this.close();
    });
  },

  // 确保文档模板已被实例化
  _ensureInstantiated() {
    if (this._instantiated) return;
    
    instantiateTemplate("docs-page-template", this.docsPage);
    
    // 实例化后获取内部元素并绑定事件
    this.backHomeButton = document.getElementById("docsBackHomeBtn");
    this.docNavSteps = this.docsPage.querySelectorAll(".docs-nav-step");
    this.docPages = this.docsPage.querySelectorAll(".docs-step");

    this.backHomeButton?.addEventListener("click", () => this.close());
    this.docNavSteps.forEach((step) => {
      step.addEventListener("click", () => this.open(step.dataset.doc));
    });

    this._instantiated = true;
  },

  // 同步顶部按钮的文案和用途
  syncHelpButton(isDocsPage) {
    this.helpButton.innerHTML = isDocsPage
      ? '<span class="material-symbols-outlined">arrow_back</span>'
      : '<span class="material-symbols-outlined">help</span>';
    this.helpButton.setAttribute(
      "aria-label",
      isDocsPage ? "返回首页" : "打开使用文档",
    );
    this.helpButton.title = isDocsPage ? "返回首页" : "使用文档";
    this.helpButton.classList.toggle("active", isDocsPage);
  },

  // 打开指定文档页
  open(docId) {
    this._ensureInstantiated();
    this.mainPage.classList.add("hidden");
    this.docsPage.classList.remove("hidden");
    this.syncHelpButton(true);

    this.docNavSteps.forEach((step) => {
      step.classList.toggle("active", step.dataset.doc === docId);
    });
    this.docPages.forEach((page) => {
      page.classList.toggle("active", page.dataset.doc === docId);
    });

    this.closeSidebar();
  },

  // 回到主页面并保留原来的步骤状态
  close() {
    this._ensureInstantiated();
    this.docsPage.classList.add("hidden");
    this.mainPage.classList.remove("hidden");
    this.syncHelpButton(false);
    this.closeSidebar();
  },
};

