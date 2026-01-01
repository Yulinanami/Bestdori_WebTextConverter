import {
  createTimelineRenderCache,
  renderIncrementalTimeline,
} from "@utils/IncrementalTimelineRenderer.js";
import { DataUtils } from "@utils/DataUtils.js";
import { editorService } from "@services/EditorService.js";
import { createSpeakerRenderers } from "@editors/speaker/speakerRenderers.js";

// 把 actions 画成左侧卡片列表
export function attachSpeakerCanvas(editor) {
  const canvasCache = createTimelineRenderCache();

  Object.assign(editor, {
    // 渲染左侧卡片列表（对话/布局），并返回“已出现角色集合”
    renderCanvas() {
      const canvas = editor.domCache.canvas;
      if (!canvas) return new Set();

      const usedIds = editor._getUsedCharacterIds();
      const isGroupingEnabled = editor.domCache.groupCheckbox?.checked || false;
      const actions = editor.projectFileState.actions || [];
      const groupSize = 50;

      const templates =
        editor.domCache.templates ||
        (editor.domCache.templates = {
          talk: document.getElementById("text-snippet-card-template"),
          layout: document.getElementById("timeline-layout-card-template"),
        });
      const configEntries = editorService.getCurrentConfig() || {};
      const configSignature = DataUtils.shallowSignature(configEntries);
      const characterNameMap = new Map(
        Object.entries(configEntries).flatMap(([name, ids]) =>
          ids.map((id) => [id, name])
        )
      );

      const { renderSingleCard, updateCard } = createSpeakerRenderers(editor, {
        templates,
        characterNameMap,
      });

      renderIncrementalTimeline({
        container: canvas,
        actions,
        cache: canvasCache,
        renderCard: renderSingleCard,
        updateCard,
        signatureResolver: DataUtils.actionSignature,
        groupingEnabled: isGroupingEnabled,
        groupSize,
        activeGroupIndex: editor.activeGroupIndex,
        contextSignature: configSignature,
        onGroupToggle: (index) => {
          const isOpening = editor.activeGroupIndex !== index;
          editor.activeGroupIndex = isOpening ? index : null;
          editor.renderCanvas();
          if (isOpening) {
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
