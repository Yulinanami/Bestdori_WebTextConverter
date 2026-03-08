// 创建时间线卡片
import { configManager } from "@managers/configManager.js";
import { DOMUtils } from "@utils/DOMUtils.js";
import { renderCharacterAvatar } from "@utils/avatarUtils.js";

export function createCharacterNameMap(configEntries = {}) {
  return new Map(
    Object.entries(configEntries).flatMap(([name, ids]) =>
      ids.map((id) => [id, name]),
    ),
  );
}

export function updateCardSequenceNumber(cardElement, globalIndex) {
  const numberDiv = cardElement.querySelector(".card-sequence-number");
  if (numberDiv && globalIndex !== -1) {
    numberDiv.textContent = `#${globalIndex + 1}`;
  }
}

export function updateTalkCard(cardElement, action) {
  if (!cardElement?.classList.contains("talk-item")) {
    return false;
  }

  const nameDiv = cardElement.querySelector(".speaker-name");
  const avatarDiv = cardElement.querySelector(".dialogue-avatar");
  const preview = cardElement.querySelector(".dialogue-preview-text");

  if (action.speakers?.length) {
    const firstSpeaker = action.speakers[0];
    if (nameDiv) {
      nameDiv.textContent = action.speakers
        .map((speaker) => speaker.name)
        .join(" & ");
    }
    if (
      avatarDiv &&
      avatarDiv.dataset.characterId !== String(firstSpeaker.characterId || "")
    ) {
      renderCharacterAvatar(
        avatarDiv,
        firstSpeaker.characterId,
        firstSpeaker.name,
      );
      avatarDiv.dataset.characterId = String(firstSpeaker.characterId || "");
    }
  } else {
    if (nameDiv) {
      nameDiv.textContent = "旁白";
    }
    if (avatarDiv) {
      avatarDiv.classList.add("fallback");
      avatarDiv.textContent = "N";
      avatarDiv.dataset.characterId = "";
    }
  }

  if (preview) {
    preview.textContent = action.text;
  }
  return true;
}

export function updateLayoutCard(
  cardElement,
  action,
  { characterName, renderLayoutControls } = {}
) {
  if (!cardElement?.classList.contains("layout-item")) {
    return false;
  }

  const resolvedName =
    characterName || action.characterName || configManager.findCharacterNameById(action.characterId);
  cardElement.dataset.id = action.id;
  cardElement.dataset.layoutType = action.layoutType;
  DOMUtils.applyLayoutTypeClass(cardElement, action.layoutType);

  const nameDiv = cardElement.querySelector(".speaker-name");
  if (nameDiv) {
    nameDiv.textContent =
      resolvedName || `未知角色 (ID: ${action.characterId ?? "?"})`;
  }

  const avatarDiv = cardElement.querySelector(".dialogue-avatar");
  if (
    avatarDiv &&
    avatarDiv.dataset.characterId !== String(action.characterId || "")
  ) {
    renderCharacterAvatar(avatarDiv, action.characterId, resolvedName);
    avatarDiv.dataset.characterId = String(action.characterId || "");
  }

  if (typeof renderLayoutControls === "function") {
    renderLayoutControls(cardElement, action, resolvedName);
  }
  return true;
}

// 创建对话卡片
export function createTalkCard(
  action,
  { templateId = "timeline-talk-card-template", template } = {}
) {
  const templateElement = template || document.getElementById(templateId);
  if (!templateElement) {
    console.warn(`[TimelineCardFactory] 模板不存在: ${templateId}`);
    return null;
  }

  const cardFragment = templateElement.content.cloneNode(true);
  const timelineItem = cardFragment.querySelector(".timeline-item");
  if (timelineItem) {
    timelineItem.dataset.id = action.id;
  }

  const nameDiv = cardFragment.querySelector(".speaker-name");
  const avatarDiv = cardFragment.querySelector(".dialogue-avatar");
  const preview = cardFragment.querySelector(".dialogue-preview-text");

  if (action.speakers && action.speakers.length > 0) {
    const firstSpeaker = action.speakers[0];
    if (nameDiv) {
      nameDiv.textContent = action.speakers
        .map((speaker) => speaker.name)
        .join(" & ");
    }
    if (avatarDiv) {
      renderCharacterAvatar(avatarDiv, firstSpeaker.characterId, firstSpeaker.name);
    }
  } else {
    if (nameDiv) nameDiv.textContent = "旁白";
    if (avatarDiv) {
      avatarDiv.classList.add("fallback");
      avatarDiv.textContent = "N";
    }
  }

  if (preview) {
    preview.textContent = action.text;
  }

  return cardFragment;
}

// 创建布局卡片并补上控件
export function createLayoutCard(
  action,
  {
    templateId = "timeline-layout-card-template",
    template,
    renderLayoutControls,
    layoutOptions = {},
  } = {}
) {
  const templateElement = template || document.getElementById(templateId);
  if (!templateElement) {
    console.warn(`[TimelineCardFactory] 模板不存在: ${templateId}`);
    return null;
  }

  const cardFragment = templateElement.content.cloneNode(true);
  const timelineItem = cardFragment.querySelector(".timeline-item");
  if (!timelineItem) {
    return cardFragment;
  }

  timelineItem.dataset.id = action.id;
  timelineItem.dataset.layoutType = action.layoutType;
  DOMUtils.applyLayoutTypeClass(timelineItem, action.layoutType);

  const characterId = action.characterId;
  const characterName =
    action.characterName || configManager.findCharacterNameById(characterId);

  const nameDiv = cardFragment.querySelector(".speaker-name");
  if (nameDiv) {
    nameDiv.textContent =
      characterName || `未知角色 (ID: ${characterId ?? "?"})`;
  }

  const avatarDiv = cardFragment.querySelector(".dialogue-avatar");
  if (avatarDiv) {
    renderCharacterAvatar(avatarDiv, characterId, characterName);
  }

  if (typeof renderLayoutControls === "function") {
    renderLayoutControls(cardFragment, action, characterName, layoutOptions);
  }

  return cardFragment;
}
