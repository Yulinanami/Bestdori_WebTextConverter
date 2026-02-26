import { DragHelper } from "@editors/common/DragHelper.js";
import { perfLog } from "@editors/common/perfLogger.js";

// 给编辑器注入“分组拖拽排序局部刷新”能力。
export function attachGroupedReorderOptimization(editor, options = {}) {
  const {
    cardSelector = ".talk-item, .layout-item",
    getContainer,
    onBeforeFullRender,
    onFullRender,
    onLocalRenderSuccess,
    debugTag = "",
  } = options;
  const debugPrefix = debugTag ? `[PERF][${debugTag}]` : "";
  const getTriggerLabel = (trigger) => {
    if (trigger === "undo") return "撤销";
    if (trigger === "redo") return "恢复";
    if (trigger === "drag") return "拖拽";
    return trigger || "unknown";
  };

  Object.assign(editor, {
    pendingGroupedReorderRender: null,

    // 标记“当前是分组内拖拽排序”，下次渲染尝试局部刷新。
    markGroupedReorderRender(mode = "meta", trigger = "unknown", detail = "") {
      this.pendingGroupedReorderRender = { mode, trigger, detail };
    },

    // 仅更新当前展开组卡片的序号与 actionIndex。
    applyGroupedReorderRender(mode = "meta") {
      const shouldReorderByState = mode === "state";
      let activeGroupActionIds = [];
      if (shouldReorderByState) {
        const groupSize = this.baseEditor.groupSize;
        const actions = this.projectFileState.actions;
        const activeGroupIndex = this.activeGroupIndex;
        const shouldGroup =
          this.domCache.groupCheckbox.checked &&
          actions.length > groupSize &&
          activeGroupIndex !== null &&
          activeGroupIndex >= 0;
        if (shouldGroup) {
          const start = activeGroupIndex * groupSize;
          const end = Math.min(start + groupSize, actions.length);
          activeGroupActionIds = actions
            .slice(start, end)
            .map((actionItem) => actionItem.id);
        } else {
          activeGroupActionIds = actions.map((actionItem) => actionItem.id);
        }
      }
      return DragHelper.applyGroupedReorderRender({
        container: getContainer.call(this),
        cardSelector,
        groupSize: this.baseEditor.groupSize,
        totalActions: this.projectFileState.actions.length,
        isGroupingEnabled: this.domCache.groupCheckbox.checked,
        activeGroupIndex: this.activeGroupIndex,
        reorderByState: shouldReorderByState,
        activeGroupActionIds,
      });
    },

    // 统一处理状态变化后的渲染：优先局部刷新，失败则全量渲染。
    handleRenderCallback() {
      if (this.pendingGroupedReorderRender) {
        const pendingRender = this.pendingGroupedReorderRender;
        const pendingMode = pendingRender.mode;
        const pendingTrigger = pendingRender.trigger;
        const pendingDetail = pendingRender.detail;
        const triggerLabel = getTriggerLabel(pendingTrigger);
        this.pendingGroupedReorderRender = null;
        const isGroupingEnabled = this.domCache.groupCheckbox.checked;
        const modeLabel = isGroupingEnabled ? "分组模式" : "非分组模式";
        const detailText = pendingDetail ? `, 详情=${pendingDetail}` : "";
        if (this.applyGroupedReorderRender(pendingMode)) {
          if (debugPrefix) {
            perfLog(
              `${debugPrefix}[局部短路] 命中排序: 触发=${triggerLabel}, mode=${pendingMode}, 场景=${modeLabel}${detailText}`
            );
          }
          if (onLocalRenderSuccess) {
            onLocalRenderSuccess.call(this);
          }
          return;
        }
        if (debugPrefix) {
          perfLog(
            `${debugPrefix}[局部短路] 排序失败: 触发=${triggerLabel}, mode=${pendingMode}, 场景=${modeLabel}${detailText}`
          );
        }

        // 撤销/恢复的排序回放必须保证看到中间态；失败时直接全量渲染，避免被其它局部分支拦截。
        if (pendingMode === "state") {
          if (debugPrefix) {
            perfLog(
              `${debugPrefix}[局部短路] 回退全量渲染: 原因=排序回放失败, 触发=${triggerLabel}, mode=${pendingMode}${detailText}`
            );
          }
          onFullRender.call(this);
          return;
        }
      }

      if (onBeforeFullRender && onBeforeFullRender.call(this)) {
        return;
      }

      onFullRender.call(this);
    },
  });
}
