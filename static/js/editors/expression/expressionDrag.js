import { DragHelper } from "@editors/common/DragHelper.js";
import { ScrollAnimationMixin } from "@mixins/ScrollAnimationMixin.js";

// 给 expressionEditor 注入“拖拽排序能力”：拖卡片排序，拖拽时自动滚动
export function attachExpressionDrag(editor, baseEditor) {
  Object.assign(editor, {
    // 拖拽时自动滚动：把事件转交给 ScrollAnimationMixin
    handleDragScrolling: (dragEvent) => {
      const containers = [
        editor.domCache.timeline,
        editor.domCache.motionList,
        editor.domCache.expressionList,
      ];
      ScrollAnimationMixin.handleDragScrolling.call(
        editor,
        dragEvent,
        containers
      );
    },

    // 初始化：让时间线支持拖拽排序（move action 的顺序）
    initTimelineDrag() {
      const timeline = editor.domCache.timeline;
      if (!timeline) return;

      const existing = editor.sortableInstances.find(
        (instance) => instance?.el === timeline
      );
      if (existing) return;

      // 复用通用重排逻辑，避免每个编辑器重复写 splice 重排代码。
      const runReorder = DragHelper.createReorderHandler({
        runCommand: (changeFn) => baseEditor.executeCommand(changeFn),
        source: "expressionDrag",
        beforeReorder: () => {
          const isGroupingEnabled =
            editor.domCache.groupCheckbox?.checked || false;
          if (
            isGroupingEnabled &&
            editor.projectFileState?.actions?.length > (baseEditor.groupSize || 50) &&
            editor.activeGroupIndex !== null &&
            editor.activeGroupIndex >= 0
          ) {
            editor.markGroupedReorderRender?.();
          }
        },
      });

      // 使用 DragHelper 创建 onEnd 处理器
      const onEndHandler = DragHelper.createOnEndHandler({
        editor: baseEditor,
        getGroupingEnabled: () =>
          editor.domCache.groupCheckbox?.checked || false,
        groupSize: 50,
        executeFn: runReorder,
      });

      editor.sortableInstances.push(
        new Sortable(
          timeline,
          DragHelper.createSortableConfig({
            group: "timeline-cards",
            onEnd: (sortableEvent) => {
              document.removeEventListener(
                "dragover",
                editor.handleDragScrolling
              );
              editor.stopScrolling();
              if (!DragHelper.isDropInsideContainer(sortableEvent, timeline)) {
                DragHelper.handleInvalidDrop(editor);
                return;
              }
              onEndHandler(sortableEvent);
            },
            extraConfig: {
              sort: true,
              onStart: () => {
                document.addEventListener(
                  "dragover",
                  editor.handleDragScrolling
                );
              },
            },
          })
        )
      );
    },
  });
}
