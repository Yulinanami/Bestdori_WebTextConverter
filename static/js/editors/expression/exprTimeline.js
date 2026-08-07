// 动作表情时间线显示
import { buildTimelineCards } from "@utils/TimelineCardFactory.js";
import { attachGroupedActionRenderer } from "@editors/common/editorCore.js";
import { assignUI } from "@editors/expression/exprAssignRenderer.js";

// 建动作表情卡片方法
function buildRenderers(editor) {
  // 渲染布局卡片里的设置区
  const renderLayoutControls = editor.createLayoutControlsRenderer(false);

  return buildTimelineCards(editor, {
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

export function attachExprTimeline(editor) {
  attachGroupedActionRenderer(editor, {
    containerKey: "timeline",
    renderMethodName: "renderTimeline",
    resetMethodName: "resetExprTimelineCache",
    buildRenderers() {
      return buildRenderers(this);
    },
  });
}
