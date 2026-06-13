// 切换步骤并初始化对应页面
class NavigationView {
  constructor() {
    this.init();
  }

  // 绑定步骤按钮并默认打开第 1 步
  init() {
    this.mainPage = document.getElementById("mainAppPage");
    if (!this.mainPage) return;

    // 给每个步骤按钮绑定点击事件
    const navSteps = this.mainPage.querySelectorAll(".nav-step[data-step]");
    navSteps.forEach((step) => {
      step.onclick = () => {
        const stepNum = parseInt(step.dataset.step);
        this.navigateToStep(stepNum);
      };
    });

    // 默认显示第 1 步
    this.navigateToStep(1);
  }

  // 切到指定步骤
  navigateToStep(stepNum) {
    const navSteps = this.mainPage.querySelectorAll(".nav-step[data-step]");
    navSteps.forEach((step) => {
      if (parseInt(step.dataset.step) === stepNum) {
        step.classList.add("active");
      } else {
        step.classList.remove("active");
      }
    });

    const workspaceSteps = this.mainPage.querySelectorAll(
      ".workspace-step[data-step]",
    );
    workspaceSteps.forEach((step) => {
      if (parseInt(step.dataset.step) === stepNum) {
        step.classList.add("active");
      } else {
        step.classList.remove("active");
      }
    });

    // 按需初始化当前步骤
    this.initializeStepContent(stepNum);

    // 切换后回到页面顶部
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  // 每一步打开时要做的初始化
  _stepInitializerMap = {
    5: async () => {
      const [{ configView }] = await Promise.all([
        import("@views/configView.js"),
      ]);
      configView.renderConfigList();
    },

    6: async () => {
      const [{ costumeManager }] = await Promise.all([
        import("@managers/costumeManager.js"),
      ]);
      costumeManager.prepareStep();
    },

    7: async () => {
      const [{ positionManager }] = await Promise.all([
        import("@managers/positionManager.js"),
      ]);
      positionManager.prepareStep();
    },

    8: async () => {
      const [{ motionExprManager }] = await Promise.all([
        import("@managers/motionExprManager.js"),
      ]);
      motionExprManager.prepareStep();
    },
  };

  async initializeStepContent(stepNum) {
    const initializer = this._stepInitializerMap[stepNum];
    if (initializer) {
      await initializer();
    }
  }
}

export const navigationView = new NavigationView();
