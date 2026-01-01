// 拖拽时的自动滚动：鼠标靠近容器上下边缘就自动滚动

export const ScrollAnimationMixin = {
  // 处理 dragover：根据鼠标位置决定是否开始自动滚动
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

    // 根据鼠标离顶部/底部的距离决定滚动方向和速度
    const rect = scrollTarget.getBoundingClientRect();
    const mouseY = e.clientY;
    const hotZone = 75; // 热区高度（像素）
    let newScrollSpeed = 0;

    if (mouseY < rect.top + hotZone) {
      newScrollSpeed = -10; // 向上滚动
    } else if (mouseY > rect.bottom - hotZone) {
      newScrollSpeed = 10; // 向下滚动
    }

    // 开始滚动 / 更新滚动速度 / 停止滚动
    if (newScrollSpeed !== 0) {
      if (newScrollSpeed !== this.scrollSpeed || !this.scrollAnimationFrame) {
        this.scrollSpeed = newScrollSpeed;
        this.startScrolling(scrollTarget);
      }
    } else {
      this.stopScrolling();
    }
  },

  // 开始自动滚动（用 requestAnimationFrame 让滚动更平滑）
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

  // 停止自动滚动
  stopScrolling() {
    if (this.scrollAnimationFrame) {
      cancelAnimationFrame(this.scrollAnimationFrame);
      this.scrollAnimationFrame = null;
    }
    this.scrollSpeed = 0;
  },
};
