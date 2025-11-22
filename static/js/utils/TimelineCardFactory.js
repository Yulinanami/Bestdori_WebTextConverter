// TimelineCardFactory - 统一创建编辑器时间轴所需的卡片
import { editorService } from "@services/EditorService.js";
import { DOMUtils } from "@utils/DOMUtils.js";

/**
 * 创建对话卡片
 * @param {Object} action - 动作对象
 * @param {Object} options
 * @param {string} options.templateId - 模板ID
 * @returns {DocumentFragment|null}
 */
export function createTalkCard(
  action,
  { templateId = "timeline-talk-card-template" } = {}
) {
  const template = document.getElementById(templateId);
  if (!template) {
    console.warn(`[TimelineCardFactory] 模板不存在: ${templateId}`);
    return null;
  }

  const card = template.content.cloneNode(true);
  const item = card.querySelector(".timeline-item");
  if (item) {
    item.dataset.id = action.id;
  }

  const nameDiv = card.querySelector(".speaker-name");
  const avatarDiv = card.querySelector(".dialogue-avatar");
  const preview = card.querySelector(".dialogue-preview-text");

  if (action.speakers && action.speakers.length > 0) {
    const firstSpeaker = action.speakers[0];
    if (nameDiv) {
      nameDiv.textContent = action.speakers.map((s) => s.name).join(" & ");
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

  return card;
}

/**
 * 创建布局卡片
 * @param {Object} action - 布局动作
 * @param {Object} options
 * @param {string} options.templateId - 模板ID
 * @param {Function} options.renderLayoutControls - 渲染布局控制的回调
 * @param {Object} options.layoutOptions - 传递给控制渲染的附加参数
 * @returns {DocumentFragment|null}
 */
export function createLayoutCard(
  action,
  {
    templateId = "timeline-layout-card-template",
    renderLayoutControls,
    layoutOptions = {},
  } = {}
) {
  const template = document.getElementById(templateId);
  if (!template) {
    console.warn(`[TimelineCardFactory] 模板不存在: ${templateId}`);
    return null;
  }

  const card = template.content.cloneNode(true);
  const item = card.querySelector(".timeline-item");
  if (!item) {
    return card;
  }

  item.dataset.id = action.id;
  item.dataset.layoutType = action.layoutType;
  DOMUtils.applyLayoutTypeClass(item, action.layoutType);

  const characterId = action.characterId;
  const characterName =
    action.characterName || editorService.getCharacterNameById(characterId);

  const nameDiv = card.querySelector(".speaker-name");
  if (nameDiv) {
    nameDiv.textContent =
      characterName || `未知角色 (ID: ${characterId ?? "?"})`;
  }

  const avatarDiv = card.querySelector(".dialogue-avatar");
  if (avatarDiv) {
    editorService.updateCharacterAvatar(
      { querySelector: () => avatarDiv },
      characterId,
      characterName
    );
  }

  if (typeof renderLayoutControls === "function") {
    renderLayoutControls(card, action, characterName, layoutOptions);
  }

  return card;
}
