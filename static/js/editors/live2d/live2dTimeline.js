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
  // Live2D 直接在布局卡里打开自定义终点位置 所以这里始终露出编辑按钮
  const renderLayoutControls = editor.createLayoutControlsRenderer(true);

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
        if (clickEvent.target.closest(".layout-remove-btn")) {
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
          const actionId = layoutCard.dataset.id;
          // Live2D 和 speaker 共用同一套展开收起逻辑
          editor.toggleCustomToPosition(actionId);
          return;
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
