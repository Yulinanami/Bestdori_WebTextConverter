import { DragHelper } from "../../utils/DragHelper.js";
import { ScrollAnimationMixin } from "../../mixins/ScrollAnimationMixin.js";

// 拖拽与自动滚动
export function attachExpressionDrag(editor, baseEditor) {
  Object.assign(editor, {
    handleDragScrolling: (e) => {
      const containers = [
        editor.domCache.timeline,
        editor.domCache.motionList,
        editor.domCache.expressionList,
      ];
      ScrollAnimationMixin.handleDragScrolling.call(editor, e, containers);
    },

    // 初始化时间轴拖拽排序
    initTimelineDrag() {
      const timeline = editor.domCache.timeline;
      if (!timeline) return;

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

      // 清理旧的 Sortable 实例
      editor.sortableInstances.forEach((instance) => instance?.destroy());
      editor.sortableInstances = [];

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
