// 处理 Live2D 编辑器拖拽
import { DragHelper } from "@editors/common/DragHelper.js";

// 添加拖拽能力
export function attachLive2DDrag(editor) {
  Object.assign(editor, {
    // 拖动时自动滚动
    handleDragScrolling: DragHelper.createAutoScrollHandler(editor, [
      editor.domCache.timeline,
      editor.domCache.characterList,
    ]),

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
            // 开始拖拽时开启自动滚动监听
            onStart: () => DragHelper.startDocumentAutoScroll(editor),
            // 结束拖拽时关闭自动滚动监听
            onEnd: () => DragHelper.stopDocumentAutoScroll(editor),
          })
        );
      }

      // 时间线重排统一走 DragHelper 里的默认结束处理
      const onEndHandler = DragHelper.createEditorOnEndHandler(editor, 50);

      // 创建新增卡片处理
      const onAddHandler = DragHelper.createOnAddHandler({
        editor,
        groupSize: 50,
        // 只允许角色卡片拖进时间线
        validateItem: (item) => item.classList.contains("character-item"),
        // 从拖进来的角色卡片上取出角色信息
        extractData: (item) => ({
          characterId: parseInt(item.dataset.characterId),
          characterName: item.dataset.characterName,
        }),
        // 把角色信息转成一条布局动作
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
              // 结束拖拽时先判断是否真的落进时间线
              onEnd: (sortableEvent) => {
                DragHelper.stopDocumentAutoScroll(editor);
                if (!DragHelper.isDropInsideContainer(sortableEvent, timeline)) {
                  editor.applyGroupReorder("state");
                  return;
                }
                onEndHandler(sortableEvent);
              },
              onAdd: onAddHandler,
              extraConfig: {
                sort: true,
                filter: ".timeline-group-header",
                // 开始拖拽时开启自动滚动监听
                onStart: () => DragHelper.startDocumentAutoScroll(editor),
              },
            })
          )
        );
      }
    },
  });
}
