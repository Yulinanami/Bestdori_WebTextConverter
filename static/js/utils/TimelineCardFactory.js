// TimelineCardFactory - 统一创建编辑器时间轴所需的卡片
import { editorService } from "@services/EditorService.js";
import { DOMUtils } from "@utils/DOMUtils.js";

// 创建一张“对话卡片”（talk）
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
      editorService.updateCharacterAvatar(
        { querySelector: () => avatarDiv },
        firstSpeaker.characterId,
        firstSpeaker.name
      );
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

// 创建一张“布局卡片”（layout），并调用 renderLayoutControls 去渲染控件
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
    action.characterName || editorService.getCharacterNameById(characterId);

  const nameDiv = cardFragment.querySelector(".speaker-name");
  if (nameDiv) {
    nameDiv.textContent =
      characterName || `未知角色 (ID: ${characterId ?? "?"})`;
  }

  const avatarDiv = cardFragment.querySelector(".dialogue-avatar");
  if (avatarDiv) {
    editorService.updateCharacterAvatar(
      { querySelector: () => avatarDiv },
      characterId,
      characterName
    );
  }

  if (typeof renderLayoutControls === "function") {
    renderLayoutControls(cardFragment, action, characterName, layoutOptions);
  }

  return cardFragment;
}
