import {
  createTimelineRenderCache,
  renderIncrementalTimeline,
} from "@utils/IncrementalTimelineRenderer.js";
import { DataUtils } from "@utils/DataUtils.js";
import { editorService } from "@services/EditorService.js";
import { createSpeakerRenderers } from "@editors/speaker/speakerRenderers.js";

// 负责渲染左侧对话/布局卡片，以及多说话人弹窗
export function attachSpeakerCanvas(editor) {
  const canvasCache = createTimelineRenderCache();

  Object.assign(editor, {
    /**
     * 渲染左侧对话卡片画布
     * 支持分组模式和普通模式两种渲染方式:
     * - 分组模式: 每50条对话折叠为一组,提升长剧本性能
     * - 普通模式: 一次性渲染所有对话卡片
     * 卡片显示对话文本、说话人头像、序号,支持多说话人徽章
     * @returns {Set<number>} 已使用的角色ID集合
     */
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
