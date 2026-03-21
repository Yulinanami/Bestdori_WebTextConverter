// 对话编辑器左边的卡片列表
import { DataUtils } from "@utils/DataUtils.js";
import { state } from "@managers/stateManager.js";
import { attachGroupedActionRenderer } from "@editors/common/editorCore.js";
import { buildNameMap } from "@utils/TimelineCardFactory.js";
import { buildSpeakerCards } from "@editors/speaker/speakerRenderers.js";

// 给编辑器添加左侧卡片显示
export function attachSpeakerCanvas(editor) {
  Object.assign(editor, {
    // 读取这次要用的方法
    buildRendererSet() {
      const templates =
        this.domCache.templates ||
        (this.domCache.templates = {
          talk: document.getElementById("text-snippet-card-template"),
          layout: document.getElementById("timeline-layout-card-template"),
        });
      const configEntries = state.currentConfig || {};
      return {
        configSignature: DataUtils.shallowSignature(configEntries),
        ...buildSpeakerCards(this, {
          templates,
          characterNameMap: buildNameMap(configEntries),
        }),
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
      return this.listUsedIds();
    },
  });
}
