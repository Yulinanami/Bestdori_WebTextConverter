import { DragHelper } from "../../utils/DragHelper.js";
import { ScrollAnimationMixin } from "../../mixins/ScrollAnimationMixin.js";

// 拖拽和自动滚动相关逻辑
export function attachLive2dDrag(editor, baseEditor) {
  Object.assign(editor, {
    handleDragScrolling: (e) => {
      const containers = [
        editor.domCache.timeline,
        editor.domCache.characterList,
      ];
      ScrollAnimationMixin.handleDragScrolling.call(editor, e, containers);
    },

    // 初始化拖放功能（角色列表拖入时间轴创建布局动作）
    initDragAndDrop() {
      const characterList = editor.domCache.characterList;
      const timeline = editor.domCache.timeline;
      if (!characterList || !timeline) return;

      // 清理旧的 Sortable 实例
      editor.sortableInstances.forEach((instance) => instance?.destroy());
      editor.sortableInstances = [];

      // 角色列表的 Sortable 配置（只允许拖出，不允许排序）
      editor.sortableInstances.push(
        new Sortable(characterList, {
          group: {
            name: "live2d-shared",
            pull: "clone",
            put: false,
          },
          sort: false,
          onStart: () =>
            document.addEventListener("dragover", editor.handleDragScrolling),
          onEnd: () => {
            document.removeEventListener(
              "dragover",
              editor.handleDragScrolling
            );
            editor.stopScrolling();
          },
        })
      );

      // 使用 DragHelper 创建 onEnd 处理器（移动现有卡片）
      const onEndHandler = DragHelper.createOnEndHandler({
        editor: baseEditor,
        getGroupingEnabled: () =>
          editor.domCache.groupCheckbox?.checked || false,
        groupSize: 50,
        executeFn: (globalOldIndex, globalNewIndex) => {
          editor._executeCommand((currentState) => {
            // 验证索引有效性
            if (
              globalOldIndex < 0 ||
              globalOldIndex >= currentState.actions.length
            ) {
              console.error(
                `Invalid globalOldIndex: ${globalOldIndex}, actions length: ${currentState.actions.length}`
              );
              return;
            }

            const [movedItem] = currentState.actions.splice(globalOldIndex, 1);

            // 验证 movedItem 存在
            if (!movedItem) {
              console.error(
                `movedItem is undefined at index ${globalOldIndex}`
              );
              return;
            }

            currentState.actions.splice(globalNewIndex, 0, movedItem);
          });
        },
      });

      // 使用 DragHelper 创建 onAdd 处理器（添加新卡片）
      const onAddHandler = DragHelper.createOnAddHandler({
        editor: baseEditor,
        getGroupingEnabled: () =>
          editor.domCache.groupCheckbox?.checked || false,
        groupSize: 50,
        validateItem: (item) => item.classList.contains("character-item"),
        extractData: (item) => ({
          characterId: parseInt(item.dataset.characterId),
          characterName: item.dataset.characterName,
        }),
        executeFn: (data, globalInsertIndex) => {
          if (data.characterId && data.characterName) {
            editor.insertLayoutAction(
              data.characterId,
              data.characterName,
              globalInsertIndex
            );
          }
        },
      });

      // 时间轴的 Sortable 配置
      editor.sortableInstances.push(
        new Sortable(
          timeline,
          DragHelper.createSortableConfig({
            group: "live2d-shared",
            onEnd: (evt) => {
              document.removeEventListener(
                "dragover",
                editor.handleDragScrolling
              );
              editor.stopScrolling();
              onEndHandler(evt);
            },
            onAdd: onAddHandler,
            extraConfig: {
              sort: true,
              filter: ".timeline-group-header",
              onStart: () =>
                document.addEventListener(
                  "dragover",
                  editor.handleDragScrolling
                ),
            },
          })
        )
      );
    },
  });
}
