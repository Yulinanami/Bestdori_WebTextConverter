import { bindTimelineEvents } from "@editors/expression/timeline/timelineEvents.js";
import { renderTimeline } from "@editors/expression/timeline/timelineRenderer.js";

// 给 expressionEditor：渲染卡片、绑定点击/修改事件。
export function attachExpressionTimeline(editor) {
  Object.assign(editor, {
    // 绑定时间线交互（点击设置/删除、修改延迟等）
    bindTimelineEvents() {
      bindTimelineEvents(editor);
    },

    // 渲染时间线卡片（支持分组模式）
    renderTimeline() {
      renderTimeline(editor);
    },
  });
}
