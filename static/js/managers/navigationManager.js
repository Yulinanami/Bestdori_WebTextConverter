// 切换步骤并初始化对应页面

class NavigationManager {
  constructor() {
    // 创建后立即绑定导航事件
    this.init();
  }

  // 绑定步骤按钮并默认打开第 1 步
  init() {
    // 给每个步骤按钮绑定点击事件
    const navSteps = document.querySelectorAll(".nav-step");
    navSteps.forEach((step) => {
      // 点击后切到对应步骤
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
    // 更新左侧高亮
    const navSteps = document.querySelectorAll(".nav-step");
    navSteps.forEach((step) => {
      if (parseInt(step.dataset.step) === stepNum) {
        step.classList.add("active");
      } else {
        step.classList.remove("active");
      }
    });

    // 更新右侧内容
    const workspaceSteps = document.querySelectorAll(".workspace-step");
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
    // 第 5 步加载角色配置
    5: async () => {
      const [{ configManager }] = await Promise.all([
        import("@managers/configManager.js"),
      ]);
      configManager.renderConfigList();
    },

    // 第 6 步准备服装配置
    6: async () => {
      const [{ costumeManager }] = await Promise.all([
        import("@managers/costumeManager.js"),
      ]);
      costumeManager.prepareStep();
    },

    // 第 7 步准备位置配置
    7: async () => {
      const [{ positionManager }] = await Promise.all([
        import("@managers/positionManager.js"),
      ]);
      positionManager.prepareStep();
    },

    // 第 8 步准备动作和表情配置
    8: async () => {
      const [{ motionExpressionManager }] = await Promise.all([
        import("@managers/motionExpressionManager.js"),
      ]);
      motionExpressionManager.prepareStep();
    },
  };

  // 进入步骤时执行对应的初始化
  async initializeStepContent(stepNum) {
    const initializer = this._stepInitializerMap[stepNum];
    if (initializer) {
      await initializer();
    }
  }
}

// 导出单例
export const navigationManager = new NavigationManager();
