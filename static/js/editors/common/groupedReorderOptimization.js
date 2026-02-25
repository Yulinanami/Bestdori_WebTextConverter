import { DragHelper } from "@editors/common/DragHelper.js";

// 给编辑器注入“分组拖拽排序局部刷新”能力。
export function attachGroupedReorderOptimization(editor, options = {}) {
  const {
    cardSelector = ".talk-item, .layout-item",
    getContainer = () => null,
    onFullRender = () => {},
    onLocalRenderSuccess,
  } = options;

  Object.assign(editor, {
    pendingGroupedReorderRender: false,

    // 标记“当前是分组内拖拽排序”，下次渲染尝试局部刷新。
    markGroupedReorderRender() {
      this.pendingGroupedReorderRender = true;
    },

    // 仅更新当前展开组卡片的序号与 actionIndex。
    applyGroupedReorderRender() {
      return DragHelper.applyGroupedReorderRender({
        container: getContainer.call(this),
        cardSelector,
        groupSize: this.baseEditor?.groupSize || 50,
        totalActions: this.projectFileState?.actions?.length || 0,
        isGroupingEnabled: this.domCache.groupCheckbox?.checked || false,
        activeGroupIndex: this.activeGroupIndex,
      });
    },

    // 统一处理状态变化后的渲染：优先局部刷新，失败则全量渲染。
    handleRenderCallback() {
      if (this.pendingGroupedReorderRender) {
        this.pendingGroupedReorderRender = false;
        if (this.applyGroupedReorderRender()) {
          if (onLocalRenderSuccess) {
            onLocalRenderSuccess.call(this);
          }
          return;
        }
      }

      onFullRender.call(this);
    },
  });
}
