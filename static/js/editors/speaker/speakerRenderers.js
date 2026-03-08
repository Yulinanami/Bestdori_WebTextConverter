// 对话卡片显示
import { DOMUtils } from "@utils/DOMUtils.js";
import { renderCharacterAvatar } from "@utils/avatarUtils.js";

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

// 刷新卡片序号
function updateCardSequenceNumber(cardElement, globalIndex) {
  const numberDiv = cardElement.querySelector(".card-sequence-number");
  if (numberDiv && globalIndex !== -1) {
    numberDiv.textContent = `#${globalIndex + 1}`;
  }
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
    renderCharacterAvatar(avatarDiv, firstSpeaker.characterId, firstSpeaker.name);
    speakerNameDiv.textContent = speakers.map((speaker) => speaker.name).join(" & ");

    if (speakers.length > 1) {
      multiSpeakerBadge.classList.remove("hidden");
      multiSpeakerBadge.style.display = "flex";
      multiSpeakerBadge.textContent = `+${speakers.length - 1}`;
      avatarContainer.style.cursor = "pointer";
      // 多说话人时点头像打开弹窗
      avatarContainer.addEventListener("click", (clickEvent) => {
        clickEvent.stopPropagation();
        editor.showMultiSpeakerPopover(action.id, avatarContainer);
      });
    } else {
      multiSpeakerBadge.classList.add("hidden");
      avatarContainer.style.cursor = "default";
    }
  } else {
    avatarContainer.classList.add("hidden");
    speakerNameDiv.classList.add("hidden");
    multiSpeakerBadge.classList.add("hidden");
    dialogueItem.classList.add("narrator");
  }

  dialogueItem.querySelector(".dialogue-text").textContent = action.text;
}

// 渲染一张布局卡片
function renderLayoutCard(cardElement, action, characterNameMap, editor) {
  const layoutItem = cardElement.firstElementChild || cardElement;
  layoutItem.dataset.id = action.id;
  layoutItem.dataset.layoutType = action.layoutType;
  layoutItem.classList.remove("dialogue-item");
  layoutItem.classList.add("layout-item");
  DOMUtils.applyLayoutTypeClass(layoutItem, action.layoutType);

  const characterName = resolveCharacterName(action, characterNameMap);
  layoutItem.querySelector(".speaker-name").textContent =
    characterName || `未知角色 (ID: ${action.characterId})`;
  renderCharacterAvatar(
    layoutItem.querySelector(".dialogue-avatar"),
    action.characterId,
    characterName,
  );
  editor.renderLayoutCardControls(cardElement, action, characterName, {
    showToggleButton: false,
  });
}

// 建对话卡片方法
export function createSpeakerRenderers(
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
      cardElement = templates.layout.content.cloneNode(true);
      renderLayoutCard(cardElement, action, characterNameMap, editor);
    } else {
      return null;
    }

    const renderedCard =
      cardElement?.nodeType === Node.DOCUMENT_FRAGMENT_NODE
        ? cardElement.firstElementChild
        : cardElement;
    if (!renderedCard) return null;

    updateCardSequenceNumber(renderedCard, globalIndex);

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
      const characterName = resolveCharacterName(action, characterNameMap);
      cardElement.dataset.id = action.id;
      cardElement.dataset.layoutType = action.layoutType;
      DOMUtils.applyLayoutTypeClass(cardElement, action.layoutType);
      const nameEl = cardElement.querySelector(".speaker-name");
      if (nameEl) {
        nameEl.textContent =
          characterName || `未知角色 (ID: ${action.characterId})`;
      }
      const avatarDiv = cardElement.querySelector(".dialogue-avatar");
      if (avatarDiv && avatarDiv.dataset.characterId !== String(action.characterId || "")) {
        renderCharacterAvatar(avatarDiv, action.characterId, characterName);
        avatarDiv.dataset.characterId = String(action.characterId || "");
      }
      editor.renderLayoutCardControls(cardElement, action, characterName, {
        showToggleButton: false,
      });
    } else {
      return false;
    }

    updateCardSequenceNumber(cardElement, globalIndex);
    return true;
  };

  return { renderSingleCard, updateCard };
}
