// 切换步骤并初始化对应页面
import { configView } from "@views/configView.js";
import { costumeManager } from "@managers/costumeManager.js";
import { positionManager } from "@managers/positionManager.js";
import { motionExprManager } from "@managers/motionExprManager.js";

class NavigationView {
  constructor() {
    this.init();
  }

  // 绑定步骤按钮并默认打开第 1 步
  init() {
    this.mainPage = document.getElementById("mainAppPage");
    if (!this.mainPage) return;

    // 统一处理侧栏和页脚的步骤按钮
    this.mainPage.addEventListener("click", (clickEvent) => {
      const trigger = clickEvent.target.closest(
        ".nav-step[data-step], [data-target-step]",
      );
      if (!trigger) return;
      this.navigateToStep(
        Number(trigger.dataset.targetStep || trigger.dataset.step),
      );
    });

    // 默认显示第 1 步
    this.navigateToStep(1);
  }

  // 切到指定步骤
  navigateToStep(stepNum) {
    this.mainPage
      .querySelectorAll(".nav-step[data-step], .workspace-step[data-step]")
      .forEach((step) => {
        step.classList.toggle("active", Number(step.dataset.step) === stepNum);
      });

    // 按需初始化当前步骤
    this.initializeStepContent(stepNum);

    // 切换后回到页面顶部
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  // 每一步打开时要做的初始化
  _stepInitializerMap = {
    5: () => configView.renderConfigList(),
    6: () => costumeManager.prepareStep(),
    7: () => positionManager.prepareStep(),
    8: () => motionExprManager.prepareStep(),
  };

  initializeStepContent(stepNum) {
    this._stepInitializerMap[stepNum]?.();
  }
}

new NavigationView();
