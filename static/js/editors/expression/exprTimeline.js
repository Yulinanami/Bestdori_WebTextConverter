// 动作表情时间线显示
import { createCache, renderFast, clearCache } from "@utils/timelineRender.js";
import { DataUtils } from "@utils/DataUtils.js";
import { state } from "@managers/stateManager.js";
import { createTalkCard, createLayoutCard, buildNameMap, updateCardIndex, updateLayoutCard, updateTalkCard } from "@utils/TimelineCardFactory.js";
import { assignUI } from "@editors/expression/exprAssignRenderer.js";
import { scrollToGroupHeader } from "@editors/common/groupHeaderUtils.js";

// 时间线缓存
const timelineCache = createCache();

// 清空时间线缓存
export function clearExprCache() {
  clearCache(timelineCache);
}

// 建动作表情卡片方法
function buildRenderers(editor) {
  const templates =
    editor.domCache.templates ||
    (editor.domCache.templates = {
      talk: document.getElementById("timeline-talk-card-template"),
      layout: document.getElementById("timeline-layout-card-template"),
    });
  const configEntries = state.currentConfig || {};
  const characterNameMap = buildNameMap(configEntries);
  const configSignature = DataUtils.shallowSignature(configEntries);
  // 渲染布局卡片里的设置区
  const renderLayoutControls = (cardEl, layoutAction, characterName) =>
    editor.renderLayoutControls(cardEl, layoutAction, characterName, {
      showToggleButton: false,
    });

  // 渲染一张卡片
  const renderSingleCard = (action, globalIndex = -1) => {
    let cardElement;

    if (action.type === "talk") {
      cardElement = createTalkCard(action, {
        template: templates.talk,
        templateId: templates.talk?.id || "text-snippet-card-template",
      });
    } else if (action.type === "layout") {
      const resolvedName =
        action.characterName || characterNameMap.get(action.characterId);
      cardElement = createLayoutCard(
        { ...action, characterName: resolvedName },
        {
          template: templates.layout,
          templateId: templates.layout?.id || "timeline-layout-card-template",
          renderLayoutControls,
        },
      );
    } else {
      return null;
    }

    const renderedCard =
      cardElement?.nodeType === Node.DOCUMENT_FRAGMENT_NODE
        ? cardElement.firstElementChild
        : cardElement;
    if (!renderedCard) return null;

    updateCardIndex(renderedCard, globalIndex);
    assignUI.renderCardFooter(editor, renderedCard, { action });

    return renderedCard;
  };

  // 尝试只更新卡片内容
  const updateCard = (action, cardElement, globalIndex = -1) => {
    if (!cardElement) return false;
    const updated =
      (action.type === "talk" && updateTalkCard(cardElement, action)) ||
      (action.type === "layout" &&
        updateLayoutCard(cardElement, action, {
          characterName: characterNameMap.get(action.characterId),
          renderLayoutControls,
        }));
    if (!updated) {
      return false;
    }

    updateCardIndex(cardElement, globalIndex);
    assignUI.renderCardFooter(editor, cardElement, { action });
    return true;
  };

  return { renderSingleCard, updateCard, configSignature };
}

// 渲染一张动作表情编辑器卡片
export function renderExprCard(editor, action, globalIndex = -1) {
  return buildRenderers(editor).renderSingleCard(action, globalIndex);
}

// 渲染动作表情时间线
export function renderTimeline(editor) {
  const timeline = editor.domCache.timeline;
  if (!timeline) return;

  const isGroupingEnabled = editor.domCache.groupCheckbox?.checked || false;
  const actions = editor.projectFileState.actions || [];
  const { renderSingleCard, updateCard, configSignature } =
    buildRenderers(editor);

  // 切换分组时重新渲染时间线
  renderFast({
    container: timeline,
    actions,
    cache: timelineCache,
    renderCard: renderSingleCard,
    updateCard,
    signatureResolver: DataUtils.actionSignature,
    groupingEnabled: isGroupingEnabled,
    groupSize: 50,
    activeGroupIndex: editor.activeGroupIndex,
    contextSignature: configSignature,
    // 切换分组后重画时间线并滚到当前组
    onGroupToggle: (index) => {
      const isOpening = editor.activeGroupIndex !== index;
      editor.activeGroupIndex = isOpening ? index : null;
      renderTimeline(editor);

      if (isOpening) {
        setTimeout(
          () => scrollToGroupHeader(editor.domCache.timeline, index),
          0,
        );
      }
    },
  });
}
