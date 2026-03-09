// 创建时间线卡片
import { configManager } from "@managers/configManager.js";
import { DOMUtils } from "@utils/DOMUtils.js";
import { renderAvatar } from "@utils/avatarUtils.js";

// 建一份角色 id 到名字的映射
export function buildNameMap(configEntries = {}) {
  return new Map(
    Object.entries(configEntries).flatMap(([name, ids]) =>
      ids.map((id) => [id, name]),
    ),
  );
}

// 刷新卡片序号
export function updateCardIndex(cardElement, globalIndex) {
  const numberDiv = cardElement.querySelector(".card-sequence-number");
  if (numberDiv && globalIndex !== -1) {
    numberDiv.textContent = `#${globalIndex + 1}`;
  }
}

// 刷新对话卡片内容
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
    // 说话人没变时不重画头像
    if (
      avatarDiv &&
      avatarDiv.dataset.characterId !== String(firstSpeaker.characterId || "")
    ) {
      renderAvatar(
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

// 刷新布局卡片内容
export function updateLayoutCard(
  cardElement,
  action,
  { characterName, renderLayoutControls } = {}
) {
  if (!cardElement?.classList.contains("layout-item")) {
    return false;
  }

  // 角色名优先用动作自带值 再回退到配置映射
  const resolvedName =
    characterName || action.characterName || configManager.findCharName(action.characterId);
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
    renderAvatar(avatarDiv, action.characterId, resolvedName);
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
      renderAvatar(avatarDiv, firstSpeaker.characterId, firstSpeaker.name);
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

  // 先把布局类型和角色信息写进模板 再交给控件渲染
  timelineItem.dataset.id = action.id;
  timelineItem.dataset.layoutType = action.layoutType;
  DOMUtils.applyLayoutTypeClass(timelineItem, action.layoutType);

  const characterId = action.characterId;
  const characterName =
    action.characterName || configManager.findCharName(characterId);

  const nameDiv = cardFragment.querySelector(".speaker-name");
  if (nameDiv) {
    nameDiv.textContent =
      characterName || `未知角色 (ID: ${characterId ?? "?"})`;
  }

  const avatarDiv = cardFragment.querySelector(".dialogue-avatar");
  if (avatarDiv) {
    renderAvatar(avatarDiv, characterId, characterName);
  }

  if (typeof renderLayoutControls === "function") {
    renderLayoutControls(cardFragment, action, characterName, layoutOptions);
  }

  return cardFragment;
}
