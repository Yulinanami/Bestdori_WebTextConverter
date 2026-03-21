// Live2D 时间线显示和事件
import { state } from "@managers/stateManager.js";
import { attachGroupedActionRenderer, rerenderOnGroupToggle } from "@editors/common/editorCore.js";
import { attachLayoutRefresh } from "@editors/common/layoutRefresh.js";
import { buildTimelineCards } from "@utils/TimelineCardFactory.js";

function buildRendererSet(editor) {
  const templates =
    editor.domCache.templates ||
    (editor.domCache.templates = {
      talk: document.getElementById("timeline-talk-card-template"),
      layout: document.getElementById("timeline-layout-card-template"),
    });
  const configEntries = state.currentConfig || {};
  const renderLayoutControls = (cardEl, layoutAction, characterName) =>
    editor.renderLayoutControls(cardEl, layoutAction, characterName, {
      showToggleButton: true,
    });

  const { renderSingleCard, updateCard, contextSignature } = buildTimelineCards(
    editor,
    {
      templates,
      configEntries,
      renderLayoutControls,
    },
  );

  return {
    renderSingleCard,
    updateCard,
    contextSignature,
  };
}

export function renderLive2DCard(editor, action, globalIndex = -1) {
  return buildRendererSet(editor).renderSingleCard(action, globalIndex);
}

// 给编辑器添加时间线方法
export function attachLive2DTimeline(editor) {
  Object.assign(editor, {
    // 渲染一张时间线卡片
    renderTimelineCard(action, globalIndex) {
      return renderLive2DCard(this, action, globalIndex);
    },

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
          const action = editor.findActionById(actionId);
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
            editor.executeActionChange(actionId, (currentAction) => {
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
            editor.executeActionChange(actionId, (currentAction) => {
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
  });

  attachGroupedActionRenderer(editor, {
    containerKey: "timeline",
    renderMethodName: "renderTimeline",
    resetMethodName: "resetTimelineCache",
    buildRenderers() {
      return buildRendererSet(this);
    },
  });

  attachLayoutRefresh(editor, {
    containerKey: "timeline",
    showToggleButton: true,
    renderActionCard: (currentEditor, action, globalIndex) =>
      currentEditor.renderTimelineCard(action, globalIndex),
    onGroupToggle(groupIndex, isOpening) {
      rerenderOnGroupToggle(this, groupIndex, isOpening, {
        renderView: this.renderTimeline,
      });
    },
    onMutationApplied() {
      this.renderUsedList();
    },
  });
}
