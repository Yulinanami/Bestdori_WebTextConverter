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
        // 拖拽重排时直接改时间线数据
        runCommand: (changeFn) => editor.executeCommand(changeFn),
        // 重排前先记下这次排序信息
        beforeReorder: (globalOldIndex, globalNewIndex) => {
          editor.markGroupReorder(
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
            // 结束拖拽时先判断是否真的落进时间线
            onEnd: (sortableEvent) => {
              document.removeEventListener(
                "dragover",
                editor.handleDragScrolling
              );
              DragHelper.stopAutoScroll(editor);
              if (!DragHelper.isDropInsideContainer(sortableEvent, timeline)) {
                editor.applyGroupReorder("state");
                return;
              }
              onEndHandler(sortableEvent);
            },
            extraConfig: {
              sort: true,
              // 开始拖拽时开启自动滚动监听
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
