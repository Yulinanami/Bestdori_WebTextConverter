// 处理动作表情编辑器拖拽
import { DragHelper } from "@editors/common/DragHelper.js";

// 添加拖拽能力
export function attachExpressionDrag(editor) {
  Object.assign(editor, {
    // 拖动时自动滚动
    handleDragScrolling: DragHelper.createAutoScrollHandler(editor, [
      editor.domCache.timeline,
      editor.domCache.motionList,
      editor.domCache.expressionList,
    ]),

    // 初始化拖拽排序
    initTimelineDrag() {
      const timeline = editor.domCache.timeline;
      if (!timeline) return;

      const existing = editor.sortableInstances.find(
        (instance) => instance?.el === timeline
      );
      if (existing) return;

      // 时间线重排统一走 DragHelper 里的默认结束处理
      const onEndHandler = DragHelper.createEditorOnEndHandler(editor, 50);

      editor.sortableInstances.push(
        new Sortable(
          timeline,
          DragHelper.createSortableConfig({
            group: "timeline-cards",
            // 结束拖拽时先判断是否真的落进时间线
            onEnd: (sortableEvent) => {
              DragHelper.stopDocumentAutoScroll(editor);
              if (!DragHelper.isDropInsideContainer(sortableEvent, timeline)) {
                editor.applyGroupReorder("state");
                return;
              }
              onEndHandler(sortableEvent);
            },
            extraConfig: {
              sort: true,
              // 开始拖拽时开启自动滚动监听
              onStart: () => DragHelper.startDocumentAutoScroll(editor),
            },
          })
        )
      );
    },
  });
}
