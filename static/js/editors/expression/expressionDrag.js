import { DragHelper } from "@utils/DragHelper.js";
import { ScrollAnimationMixin } from "@mixins/ScrollAnimationMixin.js";

// 给 expressionEditor 注入“拖拽排序能力”：拖卡片排序，拖拽时自动滚动
export function attachExpressionDrag(editor, baseEditor) {
  Object.assign(editor, {
    // 拖拽时自动滚动：把事件转交给 ScrollAnimationMixin
    handleDragScrolling: (e) => {
      const containers = [
        editor.domCache.timeline,
        editor.domCache.motionList,
        editor.domCache.expressionList,
      ];
      ScrollAnimationMixin.handleDragScrolling.call(editor, e, containers);
    },

    // 初始化：让时间线支持拖拽排序（move action 的顺序）
    initTimelineDrag() {
      const timeline = editor.domCache.timeline;
      if (!timeline) return;

      const existing = editor.sortableInstances.find(
        (instance) => instance?.el === timeline
      );
      if (existing) return;

      // 使用 DragHelper 创建 onEnd 处理器
      const onEndHandler = DragHelper.createOnEndHandler({
        editor: baseEditor,
        getGroupingEnabled: () =>
          editor.domCache.groupCheckbox?.checked || false,
        groupSize: 50,
        executeFn: (globalOldIndex, globalNewIndex) => {
          editor._executeCommand((currentState) => {
            const [movedItem] = currentState.actions.splice(globalOldIndex, 1);
            currentState.actions.splice(globalNewIndex, 0, movedItem);
          });
        },
      });

      editor.sortableInstances.push(
        new Sortable(
          timeline,
          DragHelper.createSortableConfig({
            group: "timeline-cards",
            onEnd: (evt) => {
              document.removeEventListener(
                "dragover",
                editor.handleDragScrolling
              );
              editor.stopScrolling();
              onEndHandler(evt);
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
