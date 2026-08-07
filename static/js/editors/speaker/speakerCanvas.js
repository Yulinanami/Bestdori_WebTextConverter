// 对话编辑器左边的卡片列表
import { attachGroupedActionRenderer } from "@editors/common/editorCore.js";
import { getTimelineContext } from "@utils/TimelineCardFactory.js";
import { buildSpeakerCards } from "@editors/speaker/speakerRenderers.js";

// 给编辑器添加左侧卡片显示
export function attachSpeakerCanvas(editor) {
  Object.assign(editor, {
    // 读取这次要用的方法
    buildRendererSet() {
      const context = getTimelineContext(this, "text-snippet-card-template");
      return {
        contextSignature: context.contextSignature,
        ...buildSpeakerCards(this, context),
      };
    },
  });

  attachGroupedActionRenderer(editor, {
    containerKey: "canvas",
    renderMethodName: "renderCanvas",
    resetMethodName: "resetCanvasRenderCache",
    buildRenderers() {
      return this.buildRendererSet();
    },
    getReturnValue() {
      return this.actions?.listUsedIds?.();
    },
  });
}
