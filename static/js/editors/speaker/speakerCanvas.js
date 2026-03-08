// 对话编辑器左边的卡片列表
import {
  createTimelineRenderCache,
  renderIncrementalTimeline,
  resetTimelineRenderCache,
} from "@utils/IncrementalTimelineRenderer.js";
import { DataUtils } from "@utils/DataUtils.js";
import { state } from "@managers/stateManager.js";
import { createSpeakerRenderers } from "@editors/speaker/speakerRenderers.js";

// 给编辑器添加左侧卡片显示
export function attachSpeakerCanvas(editor) {
  const canvasCache = createTimelineRenderCache();

  Object.assign(editor, {
// 读取这次要用的方法
    buildSpeakerRendererSet() {
      const templates =
        this.domCache.templates ||
        (this.domCache.templates = {
          talk: document.getElementById("text-snippet-card-template"),
          layout: document.getElementById("timeline-layout-card-template"),
        });
      const configEntries = state.currentConfig || {};
      return {
        configSignature: DataUtils.shallowSignature(configEntries),
        ...createSpeakerRenderers(this, {
          templates,
          characterNameMap: new Map(
            Object.entries(configEntries).flatMap(([name, ids]) =>
              ids.map((id) => [id, name])
            )
          ),
        }),
      };
    },

    // 清空左侧列表缓存
    resetCanvasRenderCache: () => resetTimelineRenderCache(canvasCache),

// 渲染左侧卡片列表
    renderCanvas() {
      const canvas = editor.domCache.canvas;
      if (!canvas) return new Set();

      const usedIds = editor.collectUsedCharacterIds();
      const isGroupingEnabled = editor.domCache.groupCheckbox?.checked || false;
      const actions = editor.projectFileState.actions || [];
      const { configSignature, renderSingleCard, updateCard } =
        editor.buildSpeakerRendererSet();

      // 切换分组时重新渲染列表
      renderIncrementalTimeline({
        container: canvas,
        actions,
        cache: canvasCache,
        renderCard: renderSingleCard,
        updateCard,
        signatureResolver: DataUtils.actionSignature,
        groupingEnabled: isGroupingEnabled,
        groupSize: 50,
        activeGroupIndex: editor.activeGroupIndex,
        contextSignature: configSignature,
        onGroupToggle: (index) => {
          const isOpening = editor.activeGroupIndex !== index;
          editor.activeGroupIndex = isOpening ? index : null;
          editor.renderCanvas();
          if (isOpening) {
            // 打开分组后滚到组头
            setTimeout(() => {
              const scrollContainer = editor.domCache.canvas;
              const header = scrollContainer?.querySelector(
                `.timeline-group-header[data-group-idx="${index}"]`
              );
              if (
                scrollContainer &&
                header &&
                scrollContainer.scrollTop !== header.offsetTop - 110
              ) {
                scrollContainer.scrollTo({
                  top: header.offsetTop - 110,
                  behavior: "smooth",
                });
              }
            }, 0);
          }
        },
      });

      return usedIds;
    },
  });
}
