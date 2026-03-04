import { DragHelper } from "@editors/common/DragHelper.js";
import { ScrollAnimationMixin } from "@mixins/ScrollAnimationMixin.js";

// 拖角色到时间线生成布局、拖卡片排序、拖拽时自动滚动
export function attachLive2DDrag(editor, baseEditor) {
  Object.assign(editor, {
    // 拖拽时自动滚动：把事件转交给 ScrollAnimationMixin
    handleDragScrolling: (dragEvent) => {
      const containers = [
        editor.domCache.timeline,
        editor.domCache.characterList,
      ];
      ScrollAnimationMixin.handleDragScrolling.call(
        editor,
        dragEvent,
        containers
      );
    },

    // 初始化拖拽：角色列表可拖出；时间线可接收并支持排序
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

      // 角色列表的 Sortable 配置（只允许拖出，不允许排序）
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
              editor.stopScrolling();
            },
          })
        );
      }

      // 复用通用重排逻辑，避免每个编辑器重复写 splice 重排代码。
      const runReorder = DragHelper.createReorderHandler({
        runCommand: (changeFn) => baseEditor.executeCommand(changeFn),
        beforeReorder: (globalOldIndex, globalNewIndex) => {
          editor.markGroupedReorderRender(
            "state",
            "drag",
            `index: ${globalOldIndex} -> ${globalNewIndex}`
          );
        },
      });

      // 使用 DragHelper 创建 onEnd 处理器（移动现有卡片）
      const onEndHandler = DragHelper.createOnEndHandler({
        editor: baseEditor,
        getGroupingEnabled: () =>
          editor.domCache.groupCheckbox?.checked || false,
        groupSize: 50,
        executeFn: runReorder,
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
          if (data.characterName) {
            editor.insertLayoutAction(
              data.characterId,
              data.characterName,
              globalInsertIndex
            );
          }
        },
      });

      // 时间轴的 Sortable 配置
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
                editor.stopScrolling();
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
