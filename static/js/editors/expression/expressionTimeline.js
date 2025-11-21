import { bindTimelineEvents } from "./timeline/timelineEvents.js";
import { renderTimeline } from "./timeline/timelineRenderer.js";

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
