import { bindTimelineEvents } from "@editors/expression/timeline/timelineEvents.js";
import { renderTimeline } from "@editors/expression/timeline/timelineRenderer.js";

// 时间轴渲染与事件绑定
export function attachExpressionTimeline(editor) {
  Object.assign(editor, {
    bindTimelineEvents() {
      bindTimelineEvents(editor);
    },

    renderTimeline() {
      renderTimeline(editor);
    },
  });
}
