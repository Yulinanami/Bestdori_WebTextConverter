// 滚动动画 Mixin
// 提供拖拽时的自动滚动功能

export const ScrollAnimationMixin = {
  /**
   * 处理拖拽时的自动滚动
   * 当鼠标接近容器边缘时触发滚动
   * @param {Event} e - dragover 事件
   * @param {HTMLElement[]} scrollContainers - 可滚动的容器数组
   */
  handleDragScrolling(e, scrollContainers) {
    if (!scrollContainers || scrollContainers.length === 0) return;

    // 确定滚动目标
    let scrollTarget = null;
    for (const container of scrollContainers) {
      if (container && container.contains(e.target)) {
        scrollTarget = container;
        break;
      }
    }

    if (!scrollTarget) {
      this.stopScrolling();
      return;
    }

    // 计算滚动速度
    const rect = scrollTarget.getBoundingClientRect();
    const mouseY = e.clientY;
    const hotZone = 75; // 热区高度（像素）
    let newScrollSpeed = 0;

    if (mouseY < rect.top + hotZone) {
      newScrollSpeed = -10; // 向上滚动
    } else if (mouseY > rect.bottom - hotZone) {
      newScrollSpeed = 10; // 向下滚动
    }

    // 启动或更新滚动
    if (newScrollSpeed !== 0) {
      if (newScrollSpeed !== this.scrollSpeed || !this.scrollAnimationFrame) {
        this.scrollSpeed = newScrollSpeed;
        this.startScrolling(scrollTarget);
      }
    } else {
      this.stopScrolling();
    }
  },

  /**
   * 使用 requestAnimationFrame 优化滚动性能
   * @param {HTMLElement} elementToScroll - 要滚动的元素
   */
  startScrolling(elementToScroll) {
    this.stopScrolling();

    const scroll = () => {
      if (elementToScroll && this.scrollSpeed !== 0) {
        elementToScroll.scrollTop += this.scrollSpeed;
        this.scrollAnimationFrame = requestAnimationFrame(scroll);
      }
    };
    scroll();
  },

  /**
   * 停止自动滚动动画
   */
  stopScrolling() {
    if (this.scrollAnimationFrame) {
      cancelAnimationFrame(this.scrollAnimationFrame);
      this.scrollAnimationFrame = null;
    }
    this.scrollSpeed = 0;
  },
};
