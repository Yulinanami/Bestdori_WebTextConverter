// Live2D 时间线显示和事件
import { createCache, renderFast, clearCache } from "@utils/timelineRender.js";
import { DataUtils } from "@utils/DataUtils.js";
import { state } from "@managers/stateManager.js";
import { scrollToGroupHeader } from "@editors/common/groupHeaderUtils.js";
import { buildCards } from "@editors/live2d/live2dCards.js";
import { buildNameMap } from "@utils/TimelineCardFactory.js";

// 给编辑器添加时间线方法
export function attachLive2DTimeline(editor) {
  const timelineCache = createCache();

  Object.assign(editor, {
    // 清空时间线缓存
    resetTimelineCache: () => clearCache(timelineCache),

    // 绑定时间线事件
    bindTimelineEvents() {
      const timeline = editor.domCache.timeline;
      if (!timeline) return;

      timeline.onclick = (clickEvent) => {
        const layoutCard = clickEvent.target.closest(".layout-item");
        if (!layoutCard) return;

        // 点按钮时删除布局卡片
        if (clickEvent.target.matches(".layout-remove-btn")) {
          const actionId = layoutCard.dataset.id;
          const action = editor.projectFileState.actions.find(
            (actionItem) => actionItem.id === actionId
          );
          editor.markLayoutMutation(actionId, "delete", {
            source: "ui",
            detail: `type=layout, character=${
              action?.characterName || action?.characterId || "?"
            }, layoutType=${action?.layoutType || "unknown"}`,
          });
          editor.deleteLayoutAction(layoutCard.dataset.id);
          return;
        }

        // 切换终点位置是否单独设置
        if (clickEvent.target.closest(".toggle-position-btn")) {
          const toggleButton = layoutCard.querySelector(".toggle-position-btn");
          const isExpanded = toggleButton.classList.contains("expanded");
          const actionId = layoutCard.dataset.id;
          editor.markLayoutChange(actionId, {
            source: "ui",
            field: "customToPosition",
            beforeValue: isExpanded,
            afterValue: !isExpanded,
          });

          if (isExpanded) {
            // 收起时把终点改回跟起点一样
            editor.executeCommand((currentState) => {
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
            // 展开后单独保存终点设置
            editor.executeCommand((currentState) => {
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
        editor.updateLayoutField(
          layoutCard.dataset.id,
          changeEvent.target,
        );
      };
    },

// 渲染时间线
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
      const configEntries = state.currentConfig || {};
      const characterNameMap = buildNameMap(configEntries);
      const { renderSingleCard, updateCard, contextSignature } =
        buildCards(editor, { templates, characterNameMap });
      const configSignature = contextSignature(configEntries);

      // 切换分组时重新渲染时间线
      renderFast({
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
        // 切换分组后重画时间线并滚到当前组
        onGroupToggle: (index) => {
          const isOpening = editor.activeGroupIndex !== index;
          editor.activeGroupIndex = isOpening ? index : null;
          editor.renderTimeline();

          if (isOpening) {
            setTimeout(
              () => scrollToGroupHeader(editor.domCache.timeline, index),
              0,
            );
          }
        },
      });
    },
  });
}
