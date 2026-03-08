// 处理 Live2D 编辑器拖拽
import { DragHelper } from "@editors/common/DragHelper.js";

// 添加拖拽能力
export function attachLive2DDrag(editor) {
  Object.assign(editor, {
    // 拖动时自动滚动
    handleDragScrolling: (dragEvent) => {
      DragHelper.handleAutoScroll(
        editor,
        dragEvent,
        [editor.domCache.timeline, editor.domCache.characterList]
      );
    },

    // 初始化拖拽
    initDragAndDrop() {
      const characterList = editor.domCache.characterList;
      const timeline = editor.domCache.timeline;
      if (!characterList || !timeline) return;

      const hasCharacterSortable = editor.sortableInstances.some(
        (instance) => instance?.el === characterList
      );
      const hasTimelineSortable = editor.sortableInstances.some(
        (instance) => instance?.el === timeline
      );

      // 角色列表只拖出不排序
      if (!hasCharacterSortable) {
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
              DragHelper.stopAutoScroll(editor);
            },
          })
        );
      }

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

      // 创建新增卡片处理
      const onAddHandler = DragHelper.createOnAddHandler({
        editor,
        groupSize: 50,
        validateItem: (item) => item.classList.contains("character-item"),
        extractData: (item) => ({
          characterId: parseInt(item.dataset.characterId),
          characterName: item.dataset.characterName,
        }),
        executeFn: (data, globalInsertIndex) => {
          if (data.characterName) {
            editor.insertLayoutAction(
              data.characterId,
              data.characterName,
              globalInsertIndex
            );
          }
        },
      });

      // 时间线支持接收和排序
      if (!hasTimelineSortable) {
        editor.sortableInstances.push(
          new Sortable(
            timeline,
            DragHelper.createSortableConfig({
              group: "live2d-shared",
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
      }
    },
  });
}
