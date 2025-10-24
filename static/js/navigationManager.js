// navigationManager.js - 管理左侧导航和步骤切换

class NavigationManager {
  constructor() {
    this.currentStep = 1;
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
    // 更新当前步骤
    this.currentStep = stepNum;

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

  initializeStepContent(stepNum) {
    // 动态导入模块，避免循环依赖
    switch (stepNum) {
      case 5: // 配置管理
        import("./configManager.js").then(({ configManager }) => {
          configManager.renderConfigList();
        });
        break;
      case 6: // 服装配置
        import("./costumeManager.js").then(({ costumeManager }) => {
          import("./stateManager.js").then(({ state }) => {
            import("./utils/DataUtils.js").then(({ DataUtils }) => {
              // 初始化临时状态
              costumeManager.originalCostumes = DataUtils.deepClone(
                state.get("currentCostumes")
              );
              costumeManager.originalAvailableCostumes = DataUtils.deepClone(
                costumeManager.availableCostumes
              );
              costumeManager.tempCostumeChanges = DataUtils.deepClone(
                state.get("currentCostumes")
              );
              costumeManager.tempAvailableCostumes = DataUtils.deepClone(
                costumeManager.availableCostumes
              );
              costumeManager.renderCostumeList();
            });
          });
        });
        break;
      case 7: // 位置配置
        import("./positionManager.js").then(({ positionManager }) => {
          import("./utils/DataUtils.js").then(({ DataUtils }) => {
            // 初始化临时状态
            positionManager.tempAutoPositionMode =
              positionManager.autoPositionMode;
            positionManager.tempManualPositions = DataUtils.deepClone(
              positionManager.manualPositions
            );
            const autoCheckbox = document.getElementById(
              "autoPositionCheckbox"
            );
            if (autoCheckbox) {
              autoCheckbox.checked = positionManager.tempAutoPositionMode;
            }
            positionManager.renderPositionList();
            positionManager.toggleManualConfig();
          });
        });
        break;
      case 8: // 动作/表情配置
        import("./motionExpressionEditor.js").then(
          ({ motionExpressionEditor }) => {
            import("./genericConfigManager.js").then(
              ({ motionManager, expressionManager }) => {
                // 初始化临时状态（类似 open 方法的逻辑）
                motionExpressionEditor.tempCustomMotions = JSON.parse(
                  JSON.stringify(motionManager.customItems)
                );
                motionExpressionEditor.tempCustomExpressions = JSON.parse(
                  JSON.stringify(expressionManager.customItems)
                );
                motionExpressionEditor.renderLists();
              }
            );
          }
        );
        break;
    }
  }
}

// 创建全局实例
export const navigationManager = new NavigationManager();
