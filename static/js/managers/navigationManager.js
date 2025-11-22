// navigationManager.js - 管理左侧导航和步骤切换

class NavigationManager {
  constructor() {
    this.init();
  }

  init() {
    // 绑定导航项点击事件
    const navSteps = document.querySelectorAll(".nav-step");
    navSteps.forEach((step) => {
      step.addEventListener("click", () => {
        const stepNum = parseInt(step.dataset.step);
        this.navigateToStep(stepNum);
      });
    });

    // 初始化显示第一步
    this.navigateToStep(1);
  }

  navigateToStep(stepNum) {
    // 更新导航栏激活状态
    const navSteps = document.querySelectorAll(".nav-step");
    navSteps.forEach((step) => {
      if (parseInt(step.dataset.step) === stepNum) {
        step.classList.add("active");
      } else {
        step.classList.remove("active");
      }
    });

    // 更新工作区显示的步骤
    const workspaceSteps = document.querySelectorAll(".workspace-step");
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

  /**
   * 步骤内容初始化器映射
   * 使用策略模式和 async/await 替代深层 Promise 嵌套
   * @private
   */
  _stepInitializers = {
    // 配置管理
    5: async () => {
      const { configManager } = await import("@managers/configManager.js");
      configManager.renderConfigList();
    },

    // 服装配置
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

    // 位置配置
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

    // 动作/表情配置
    8: async () => {
      const [
        { motionExpressionManager },
        { motionManager, expressionManager },
      ] = await Promise.all([
        import("@managers/motionExpressionManager.js"),
        import("@managers/genericConfigManager.js"),
      ]);

      // 初始化临时状态（类似 open 方法的逻辑）
      motionExpressionManager.tempCustomMotions = JSON.parse(
        JSON.stringify(motionManager.customItems)
      );
      motionExpressionManager.tempCustomExpressions = JSON.parse(
        JSON.stringify(expressionManager.customItems)
      );
      motionExpressionManager.renderLists();
    },
  };

  async initializeStepContent(stepNum) {
    // 使用策略模式查找并执行对应的初始化器
    const initializer = this._stepInitializers[stepNum];
    if (initializer) {
      await initializer();
    }
  }
}

// 创建全局实例
export const navigationManager = new NavigationManager();
