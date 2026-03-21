// 动作表情时间线显示
import { state } from "@managers/stateManager.js";
import { buildTimelineCards } from "@utils/TimelineCardFactory.js";
import { attachGroupedActionRenderer } from "@editors/common/editorCore.js";
import { assignUI } from "@editors/expression/exprAssignRenderer.js";
let resetExprTimelineCache = () => {};

// 清空时间线缓存
export function clearExprCache() {
  resetExprTimelineCache();
}

// 建动作表情卡片方法
function buildRenderers(editor) {
  const templates =
    editor.domCache.templates ||
    (editor.domCache.templates = {
      talk: document.getElementById("timeline-talk-card-template"),
      layout: document.getElementById("timeline-layout-card-template"),
    });
  const configEntries = state.currentConfig || {};
  // 渲染布局卡片里的设置区
  const renderLayoutControls = (cardEl, layoutAction, characterName) =>
    editor.renderLayoutControls(cardEl, layoutAction, characterName, {
      showToggleButton: false,
    });

  return buildTimelineCards(editor, {
    templates,
    configEntries,
    talkTemplateId: "text-snippet-card-template",
    renderLayoutControls,
    afterRenderCard: (cardElement, action) => {
      assignUI.renderCardFooter(editor, cardElement, { action });
    },
    afterUpdateCard: (cardElement, action) => {
      assignUI.renderCardFooter(editor, cardElement, { action });
    },
  });
}

// 渲染一张动作表情编辑器卡片
export function renderExprCard(editor, action, globalIndex = -1) {
  return buildRenderers(editor).renderSingleCard(action, globalIndex);
}

export function renderTimeline(editor) {
  return editor?.renderTimeline?.();
}

export function attachExprTimeline(editor) {
  attachGroupedActionRenderer(editor, {
    containerKey: "timeline",
    renderMethodName: "renderTimeline",
    resetMethodName: "resetExprTimelineCache",
    buildRenderers() {
      return buildRenderers(this);
    },
  });

  resetExprTimelineCache = () => editor.resetExprTimelineCache?.();
}
