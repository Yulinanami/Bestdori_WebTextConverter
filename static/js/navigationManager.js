// navigationManager.js - 管理左侧导航和步骤切换

class NavigationManager {
  constructor() {
    this.currentStep = 1;
    this.init();
  }

  init() {
    // 绑定导航项点击事件
    const navSteps = document.querySelectorAll('.nav-step');
    navSteps.forEach((step) => {
      step.addEventListener('click', () => {
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
    const navSteps = document.querySelectorAll('.nav-step');
    navSteps.forEach((step) => {
      if (parseInt(step.dataset.step) === stepNum) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });

    // 更新工作区显示的步骤
    const workspaceSteps = document.querySelectorAll('.workspace-step');
    workspaceSteps.forEach((step) => {
      if (parseInt(step.dataset.step) === stepNum) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });

    // 滚动到页面顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goToNextStep() {
    if (this.currentStep < 4) {
      this.navigateToStep(this.currentStep + 1);
    }
  }

  goToPreviousStep() {
    if (this.currentStep > 1) {
      this.navigateToStep(this.currentStep - 1);
    }
  }
}

// 创建全局实例
export const navigationManager = new NavigationManager();
