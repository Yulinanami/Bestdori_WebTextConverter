// 对话卡片显示
import { renderAvatar } from "@utils/avatarUtils.js";
import { createLayoutCard, updateCardIndex, updateLayoutCard } from "@utils/TimelineCardFactory.js";

// 把说话人整理成一个 key
function buildSpeakerKey(speakers = []) {
  return speakers
    .map((speaker) => `${speaker.characterId}:${speaker.name}`)
    .join("|");
}

// 把说话人 key 存到卡片上
function applySpeakerKey(card, speakers = []) {
  card.dataset.speakerKey = buildSpeakerKey(speakers);
}

// 取角色名字
function resolveCharacterName(action, characterNameMap) {
  return action.characterName || characterNameMap.get(action.characterId);
}

// 渲染一张对话卡片
function renderTalkCard(dialogueItem, action, editor) {
  const avatarContainer = dialogueItem.querySelector(".speaker-avatar-container");
  const avatarDiv = dialogueItem.querySelector(".dialogue-avatar");
  const speakerNameDiv = dialogueItem.querySelector(".speaker-name");
  const multiSpeakerBadge = dialogueItem.querySelector(".multi-speaker-badge");
  const speakers = action.speakers || [];

  if (speakers.length > 0) {
    const firstSpeaker = speakers[0];
    avatarContainer.classList.remove("hidden");
    avatarContainer.style.display = "flex";
    speakerNameDiv.classList.remove("hidden");
    dialogueItem.classList.remove("narrator");
    
    renderAvatar(avatarDiv, firstSpeaker.characterId, firstSpeaker.name);
    speakerNameDiv.textContent = speakers.map((speaker) => speaker.name).join(" & ");

    if (speakers.length > 1) {
      multiSpeakerBadge.classList.remove("hidden");
      multiSpeakerBadge.style.display = "flex";
      multiSpeakerBadge.textContent = `+${speakers.length - 1}`;
      avatarContainer.style.cursor = "pointer";
      // 多说话人时点头像打开弹窗
      avatarContainer.addEventListener("click", (clickEvent) => {
        clickEvent.stopPropagation();
        editor.openSpeakerPopover(action.id, avatarContainer);
      });
    } else {
      multiSpeakerBadge.classList.add("hidden");
      avatarContainer.style.cursor = "grab";
    }
  } else {
    avatarContainer.classList.add("hidden");
    speakerNameDiv.classList.add("hidden");
    multiSpeakerBadge.classList.add("hidden");
    dialogueItem.classList.add("narrator");
  }

  // 根据当前编辑器是否开启了卡片排序模式来决定整个卡片是否原生可拖拽
  dialogueItem.draggable = !editor.isSortMode;
  dialogueItem.style.cursor = editor.isSortMode ? "grab" : "pointer";

  dialogueItem.querySelector(".dialogue-text").textContent = action.text;
}

// 渲染一张布局卡片
function renderLayoutCard(action, characterNameMap, editor, template) {
  const characterName = resolveCharacterName(action, characterNameMap);
  const renderLayoutControls = editor.createLayoutControlsRenderer(true);
  return createLayoutCard(
    { ...action, characterName },
    {
      template,
      templateId: template?.id || "timeline-layout-card-template",
      // 对话编辑器里的布局卡也允许直接改自定义终点位置
      renderLayoutControls,
    },
  );
}

// 建对话卡片方法
export function buildSpeakerCards(
  editor,
  { templates, characterNameMap },
) {
  // 渲染一张卡片
  const renderSingleCard = (action, globalIndex = -1) => {
    let cardElement;

    if (action.type === "talk") {
      cardElement = templates.talk.content.cloneNode(true);
      const dialogueItem = cardElement.firstElementChild;
      dialogueItem.dataset.id = action.id;
      renderTalkCard(dialogueItem, action, editor);
    } else if (action.type === "layout") {
      cardElement = renderLayoutCard(
        action,
        characterNameMap,
        editor,
        templates.layout,
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

    if (renderedCard.classList.contains("dialogue-item")) {
      applySpeakerKey(renderedCard, action.speakers || []);
    }
    return renderedCard;
  };

  // 尝试只更新卡片内容
  const updateCard = (action, cardElement, globalIndex = -1) => {
    if (!cardElement) return false;
    if (
      action.type === "talk" &&
      cardElement.classList.contains("dialogue-item")
    ) {
      const dialogueText = cardElement.querySelector(".dialogue-text");
      const speakerKey = cardElement.dataset.speakerKey || "";
      const nextSpeakerKey = buildSpeakerKey(action.speakers || []);

      if (speakerKey !== nextSpeakerKey) {
        return false;
      }

      if (dialogueText) dialogueText.textContent = action.text;
    } else if (
      action.type === "layout" &&
      cardElement.classList.contains("layout-item")
    ) {
      const renderLayoutControls = editor.createLayoutControlsRenderer(true);
      const updated = updateLayoutCard(cardElement, action, {
        characterName: resolveCharacterName(action, characterNameMap),
        // 局部刷新布局卡时也要把同一套悬浮编辑按钮一起带上
        renderLayoutControls,
      });
      if (!updated) {
        return false;
      }
    } else {
      return false;
    }

    updateCardIndex(cardElement, globalIndex);
    return true;
  };

  return { renderSingleCard, updateCard };
}
