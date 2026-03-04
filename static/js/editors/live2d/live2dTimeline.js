import {
  createTimelineRenderCache,
  renderIncrementalTimeline,
  resetTimelineRenderCache,
} from "@utils/IncrementalTimelineRenderer.js";
import { DataUtils } from "@utils/DataUtils.js";
import { editorService } from "@services/EditorService.js";
import { createLive2DRenderers } from "@editors/live2d/live2dTimelineRenderers.js";

// 渲染卡片、响应删除/控件修改等
export function attachLive2DTimeline(editor) {
  const timelineCache = createTimelineRenderCache();

  Object.assign(editor, {
    // 重置渲染缓存，确保重开编辑器时不复用旧卡片快照。
    resetTimelineCache() {
      resetTimelineRenderCache(timelineCache);
    },

    // 绑定时间线上的点击/修改事件（删除、展开终点位置、改下拉框等）
    bindTimelineEvents() {
      const timeline = editor.domCache.timeline;
      if (!timeline) return;

      timeline.onclick = (clickEvent) => {
        const layoutCard = clickEvent.target.closest(".layout-item");
        if (!layoutCard) return;

        // 删除卡片
        if (clickEvent.target.matches(".layout-remove-btn")) {
          const actionId = layoutCard.dataset.id;
          const action = editor.projectFileState.actions.find(
            (actionItem) => actionItem.id === actionId
          );
          editor.markLayoutMutationRender(actionId, "delete", {
            source: "ui",
            detail: `type=layout, character=${
              action?.characterName || action?.characterId || "?"
            }, layoutType=${action?.layoutType || "unknown"}`,
          });
          editor.deleteLayoutAction(layoutCard.dataset.id);
          return;
        }

        // 切换 to 位置信息是否独立配置
        if (clickEvent.target.closest(".toggle-position-btn")) {
          const toggleButton = layoutCard.querySelector(".toggle-position-btn");
          const isExpanded = toggleButton.classList.contains("expanded");
          const actionId = layoutCard.dataset.id;
          editor.markLayoutPropertyRender(actionId, {
            source: "ui",
            field: "customToPosition",
            beforeValue: isExpanded,
            afterValue: !isExpanded,
          });

          if (isExpanded) {
            // 收起：清除独立配置标记，并把终点位置回写为起点
            editor.baseEditor.executeCommand((currentState) => {
              const currentAction = currentState.actions.find(
                (actionItem) => actionItem.id === actionId,
              );
              if (!currentAction) {
                return;
              }
              delete currentAction.customToPosition;
              if (!currentAction.position) currentAction.position = {};
              if (!currentAction.position.from)
                currentAction.position.from = {};
              if (!currentAction.position.to) currentAction.position.to = {};
              currentAction.position.to.side =
                currentAction.position.from.side || "center";
              currentAction.position.to.offsetX =
                currentAction.position.from.offsetX || 0;
            });
          } else {
            // 展开：设置独立配置标记，UI由局部刷新统一更新
            editor.baseEditor.executeCommand((currentState) => {
              const currentAction = currentState.actions.find(
                (actionItem) => actionItem.id === actionId,
              );
              if (currentAction) {
                currentAction.customToPosition = true;
              }
            });
          }
        }
      };

      timeline.onchange = (changeEvent) => {
        const layoutCard = changeEvent.target.closest(".layout-item");
        if (!layoutCard || !changeEvent.target.matches("select, input")) return;
        editor.updateLayoutActionProperty(
          layoutCard.dataset.id,
          changeEvent.target,
        );
      };
    },

    // 渲染时间线：对话卡片只读，布局卡片可编辑（支持分组模式）
    renderTimeline() {
      const timeline = editor.domCache.timeline;
      if (!timeline) return;

      const isGroupingEnabled = editor.domCache.groupCheckbox?.checked || false;
      const actions = editor.projectFileState.actions || [];
      const templates =
        editor.domCache.templates ||
        (editor.domCache.templates = {
          talk: document.getElementById("timeline-talk-card-template"),
          layout: document.getElementById("timeline-layout-card-template"),
        });
      const configEntries = editorService.state.get("currentConfig") || {};
      const characterNameMap = new Map(
        Object.entries(configEntries).flatMap(([name, ids]) =>
          ids.map((id) => [id, name]),
        ),
      );
      const { renderSingleCard, updateCard, contextSignature } =
        createLive2DRenderers(editor, { templates, characterNameMap });
      const configSignature = contextSignature(configEntries);

      renderIncrementalTimeline({
        container: timeline,
        actions,
        cache: timelineCache,
        renderCard: renderSingleCard,
        updateCard,
        signatureResolver: DataUtils.actionSignature,
        groupingEnabled: isGroupingEnabled,
        groupSize: 50,
        activeGroupIndex: editor.activeGroupIndex,
        contextSignature: configSignature,
        onGroupToggle: (index) => {
          const isOpening = editor.activeGroupIndex !== index;
          editor.activeGroupIndex = isOpening ? index : null;
          editor.renderTimeline();

          if (isOpening) {
            setTimeout(() => {
              const scrollContainer = editor.domCache.timeline;
              const header = scrollContainer?.querySelector(
                `.timeline-group-header[data-group-idx="${index}"]`,
              );
              if (scrollContainer && header) {
                scrollContainer.scrollTo({
                  top: header.offsetTop - 110,
                  behavior: "smooth",
                });
              }
            }, 0);
          }
        },
      });
    },
  });
}
