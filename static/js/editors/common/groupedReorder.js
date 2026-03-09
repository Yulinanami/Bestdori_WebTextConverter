// 分组拖拽后的局部刷新
import { DragHelper } from "@editors/common/DragHelper.js";
import { perfLog } from "@editors/common/perfLogger.js";

// 给编辑器添加分组重排优化
export function attachGroupReorder(editor, options = {}) {
  const {
    cardSelector = ".talk-item, .layout-item",
    containerKey,
    onBeforeFullRender,
    onFullRender,
    onLocalRenderSuccess,
    debugTag = "",
  } = options;
  const debugPrefix = debugTag ? `[PERF][${debugTag}]` : "";
  // 把触发来源转成提示文字
  const resolveTriggerLabel = (trigger) => {
    if (trigger === "undo") return "撤销";
    if (trigger === "redo") return "恢复";
    if (trigger === "drag") return "拖拽";
    return trigger || "unknown";
  };

  Object.assign(editor, {
    pendingGroupReorder: null,

    // 记录一次分组重排
    markGroupReorder(mode = "meta", trigger = "unknown", detail = "") {
      // 标记分组重排刷新
      this.pendingGroupReorder = { mode, trigger, detail };
    },

    // 只刷新当前组的顺序
    applyGroupReorder(mode = "meta") {
      const shouldReorderByState = mode === "state";
      let activeGroupActionIds = [];
      if (shouldReorderByState) {
        const groupSize = this.groupSize;
        const actions = this.projectFileState.actions;
        const activeGroupIndex = this.activeGroupIndex;
        // 撤销重做时先按当前 state 算出这一组该显示哪些卡片
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
      return DragHelper.applyGroupReorder({
        container: this.domCache?.[containerKey],
        cardSelector,
        groupSize: this.groupSize,
        totalActions: this.projectFileState.actions.length,
        isGroupingEnabled: this.domCache.groupCheckbox.checked,
        activeGroupIndex: this.activeGroupIndex,
        reorderByState: shouldReorderByState,
        activeGroupActionIds,
      });
    },

    // 处理重排后的刷新
    handleRenderCallback() {
      if (this.pendingGroupReorder) {
        const pendingRender = this.pendingGroupReorder;
        const pendingMode = pendingRender.mode;
        const pendingTrigger = pendingRender.trigger;
        const pendingDetail = pendingRender.detail;
        const triggerLabel = resolveTriggerLabel(pendingTrigger);
        this.pendingGroupReorder = null;
        // 先尝试只改当前组顺序 失败后再回退全量渲染
        const isGroupingEnabled = this.domCache.groupCheckbox.checked;
        const modeLabel = isGroupingEnabled ? "分组模式" : "非分组模式";
        const detailText = pendingDetail ? `, 详情=${pendingDetail}` : "";
        if (this.applyGroupReorder(pendingMode)) {
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

        // 撤销重做失败时直接整页刷新
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
