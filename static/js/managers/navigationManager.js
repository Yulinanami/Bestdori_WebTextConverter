// 管理左侧导航点击步骤时切换右侧内容，并在需要时初始化该步骤的数据

class NavigationManager {
  constructor() {
    // 初始化：创建实例后立刻绑定导航点击事件
    this.init();
  }

  // 初始化：给左侧步骤按钮绑定点击事件，并默认跳到第 1 步
  init() {
    // 绑定导航项点击事件
    const navSteps =
      this.navSteps || (this.navSteps = document.querySelectorAll(".nav-step"));
    navSteps.forEach((step) => {
      step.onclick = () => {
        const stepNum = parseInt(step.dataset.step);
        this.navigateToStep(stepNum);
      };
    });

    // 初始化显示第一步
    this.navigateToStep(1);
  }

  // 切换到指定步骤：高亮左侧、显示右侧，并触发该步骤的初始化逻辑
  navigateToStep(stepNum) {
    // 更新导航栏激活状态
    const navSteps =
      this.navSteps || (this.navSteps = document.querySelectorAll(".nav-step"));
    navSteps.forEach((step) => {
      if (parseInt(step.dataset.step) === stepNum) {
        step.classList.add("active");
      } else {
        step.classList.remove("active");
      }
    });

    // 更新工作区显示的步骤
    const workspaceSteps =
      this.workspaceSteps ||
      (this.workspaceSteps = document.querySelectorAll(".workspace-step"));
    workspaceSteps.forEach((step) => {
      if (parseInt(step.dataset.step) === stepNum) {
        step.classList.add("active");
      } else {
        step.classList.remove("active");
      }
    });

    // 根据步骤初始化特定功能
    this.initializeStepContent(stepNum);

    // 滚动到页面顶部
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 每个步骤需要“进场初始化”时，就在这里写对应的加载逻辑
  _stepInitializers = {
    // 第 5 步：配置管理（角色列表）
    5: async () => {
      const { configManager } = await import("@managers/configManager.js");
      configManager.renderConfigList();
    },

    // 第 6 步：服装配置（初始化临时修改区，避免直接改动正式数据）
    6: async () => {
      const [{ costumeManager }, { state }, { DataUtils }] = await Promise.all([
        import("@managers/costumeManager.js"),
        import("@managers/stateManager.js"),
        import("@utils/DataUtils.js"),
      ]);

      // 初始化临时状态
      costumeManager.tempCostumeChanges = DataUtils.deepClone(
        state.get("currentCostumes")
      );
      costumeManager.tempAvailableCostumes = DataUtils.deepClone(
        costumeManager.availableCostumes
      );
      costumeManager.renderCostumeList();
    },

    // 第 7 步：位置配置（初始化临时配置，并渲染列表）
    7: async () => {
      const [{ positionManager }, { DataUtils }] = await Promise.all([
        import("@managers/positionManager.js"),
        import("@utils/DataUtils.js"),
      ]);

      // 初始化临时状态
      positionManager.tempAutoPositionMode = positionManager.autoPositionMode;
      positionManager.tempManualPositions = DataUtils.deepClone(
        positionManager.manualPositions
      );

      const autoCheckbox = document.getElementById("autoPositionCheckbox");
      if (autoCheckbox) {
        autoCheckbox.checked = positionManager.tempAutoPositionMode;
      }

      positionManager.renderPositionList();
      positionManager.toggleManualConfig();
    },

    // 第 8 步：动作/表情配置（初始化临时列表，并渲染）
    8: async () => {
      const [
        { motionExpressionManager },
        { motionManager, expressionManager },
        { DataUtils },
      ] = await Promise.all([
        import("@managers/motionExpressionManager.js"),
        import("@managers/genericConfigManager.js"),
        import("@utils/DataUtils.js"),
      ]);

      // 初始化临时状态（类似 open 方法的逻辑）
      motionExpressionManager.tempCustomMotions = DataUtils.deepClone(
        motionManager.customItems
      );
      motionExpressionManager.tempCustomExpressions = DataUtils.deepClone(
        expressionManager.customItems
      );
      motionExpressionManager.renderLists();
    },
  };

  // 进入某个步骤时，按需执行该步骤对应的初始化函数
  async initializeStepContent(stepNum) {
    // 使用策略模式查找并执行对应的初始化器
    const initializer = this._stepInitializers[stepNum];
    if (initializer) {
      await initializer();
    }
  }
}

// 创建单例（导入即生效）
export const navigationManager = new NavigationManager();
