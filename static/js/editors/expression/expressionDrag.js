// 处理动作表情编辑器拖拽
import { DragHelper } from "@editors/common/DragHelper.js";

// 添加拖拽能力
export function attachExpressionDrag(editor) {
  Object.assign(editor, {
    // 拖动时自动滚动
    handleDragScrolling: (dragEvent) => {
      DragHelper.handleAutoScroll(
        editor,
        dragEvent,
        [
          editor.domCache.timeline,
          editor.domCache.motionList,
          editor.domCache.expressionList,
        ]
      );
    },

    // 初始化拖拽排序
    initTimelineDrag() {
      const timeline = editor.domCache.timeline;
      if (!timeline) return;

      const existing = editor.sortableInstances.find(
        (instance) => instance?.el === timeline
      );
      if (existing) return;

      // 创建重排处理
      const runReorder = DragHelper.createReorderHandler({
        runCommand: (changeFn) => editor.executeCommand(changeFn),
        beforeReorder: (globalOldIndex, globalNewIndex) => {
          editor.markGroupedReorderRender(
            "state",
            "drag",
            `index: ${globalOldIndex} -> ${globalNewIndex}`
          );
        },
      });

      // 创建拖拽结束处理
      const onEndHandler = DragHelper.createOnEndHandler({
        editor,
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
              DragHelper.stopAutoScroll(editor);
              if (!DragHelper.isDropInsideContainer(sortableEvent, timeline)) {
                editor.applyGroupedReorderRender("state");
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
