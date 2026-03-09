// Live2D 卡片显示
import { DataUtils } from "@utils/DataUtils.js";
import { createTalkCard, createLayoutCard, updateCardIndex, updateLayoutCard, updateTalkCard } from "@utils/TimelineCardFactory.js";

// 创建 Live2D 卡片方法
export function buildCards(editor, { templates, characterNameMap }) {
// 刷新布局卡片上的控件
  const renderLayoutControls = (cardEl, layoutAction, characterName) =>
    editor.renderLayoutControls(cardEl, layoutAction, characterName, {
      showToggleButton: true,
    });
  // 渲染一张卡片
  const renderSingleCard = (action, globalIndex = -1) => {
    let cardElement;

    if (action.type === "talk") {
      cardElement = createTalkCard(action, {
        template: templates.talk,
        templateId: templates.talk?.id || "timeline-talk-card-template",
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
        }
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
    return true;
  };

  return {
    renderSingleCard,
    updateCard,
    // 返回当前配置签名
    contextSignature: (configEntries) =>
      DataUtils.shallowSignature(configEntries),
  };
}
