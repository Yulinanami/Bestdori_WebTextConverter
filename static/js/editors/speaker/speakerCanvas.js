// 对话编辑器左边的卡片列表
import { createCache, renderFast, clearCache } from "@utils/timelineRender.js";
import { DataUtils } from "@utils/DataUtils.js";
import { state } from "@managers/stateManager.js";
import { buildSpeakerCards } from "@editors/speaker/speakerRenderers.js";

// 给编辑器添加左侧卡片显示
export function attachSpeakerCanvas(editor) {
  const canvasCache = createCache();

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
          characterNameMap: new Map(
            Object.entries(configEntries).flatMap(([name, ids]) =>
              ids.map((id) => [id, name])
            )
          ),
        }),
      };
    },

    // 清空左侧列表缓存
    resetCanvasRenderCache: () => clearCache(canvasCache),

// 渲染左侧卡片列表
    renderCanvas() {
      const canvas = editor.domCache.canvas;
      if (!canvas) return new Set();

      const usedIds = editor.listUsedIds();
      const isGroupingEnabled = editor.domCache.groupCheckbox?.checked || false;
      const actions = editor.projectFileState.actions || [];
      const { configSignature, renderSingleCard, updateCard } =
        editor.buildRendererSet();

      // 切换分组时重新渲染列表
      renderFast({
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
        // 切换分组后重画画布并滚到当前组
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
