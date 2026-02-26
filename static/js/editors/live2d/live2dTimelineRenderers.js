import { DOMUtils } from "@utils/DOMUtils.js";
import { DataUtils } from "@utils/DataUtils.js";
import {
  createTalkCard,
  createLayoutCard,
} from "@utils/TimelineCardFactory.js";
import { editorService } from "@services/EditorService.js";
import { configUI } from "@managers/config/configUI.js";

// 创建 Live2D 编辑器的卡片渲染器：供全量渲染与局部刷新共用。
export function createLive2DRenderers(editor, { templates, characterNameMap }) {
  // renderSingleCard负责画一个卡片，updateCard 负责就地更新卡片
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
          renderLayoutControls: (cardEl, layoutAction, characterName) =>
            editor.renderLayoutCardControls(
              cardEl,
              layoutAction,
              characterName,
              {
                showToggleButton: true,
              }
            ),
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

    const numberDiv = renderedCard.querySelector(".card-sequence-number");
    if (numberDiv && globalIndex !== -1) {
      numberDiv.textContent = `#${globalIndex + 1}`;
    }
    return renderedCard;
  };

  // 尝试就地更新卡片内容（返回 false 表示需要整张重画）。
  const updateCard = (action, cardElement, globalIndex = -1) => {
    if (!cardElement) return false;
    if (
      action.type === "talk" &&
      cardElement.classList.contains("talk-item")
    ) {
      const nameDiv = cardElement.querySelector(".speaker-name");
      const avatarDiv = cardElement.querySelector(".dialogue-avatar");
      const preview = cardElement.querySelector(".dialogue-preview-text");

      if (action.speakers && action.speakers.length > 0) {
        const firstSpeaker = action.speakers[0];
        if (nameDiv) {
          nameDiv.textContent = action.speakers
            .map((speaker) => speaker.name)
            .join(" & ");
        }
        if (
          avatarDiv &&
          avatarDiv.dataset.characterId !==
            String(firstSpeaker.characterId || "")
        ) {
          configUI.updateConfigAvatar(
            editorService.configManager,
            { querySelector: () => avatarDiv },
            firstSpeaker.characterId,
            firstSpeaker.name
          );
          avatarDiv.dataset.characterId = String(
            firstSpeaker.characterId || ""
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
    } else if (
      action.type === "layout" &&
      cardElement.classList.contains("layout-item")
    ) {
      cardElement.dataset.id = action.id;
      cardElement.dataset.layoutType = action.layoutType;
      DOMUtils.applyLayoutTypeClass(cardElement, action.layoutType);

      const characterId = action.characterId;
      const characterName =
        action.characterName || characterNameMap.get(action.characterId);
      const nameDiv = cardElement.querySelector(".speaker-name");
      if (nameDiv) {
        nameDiv.textContent =
          characterName || `未知角色 (ID: ${characterId ?? "?"})`;
      }

      const avatarDiv = cardElement.querySelector(".dialogue-avatar");
      if (
        avatarDiv &&
        avatarDiv.dataset.characterId !== String(characterId || "")
      ) {
        configUI.updateConfigAvatar(
          editorService.configManager,
          { querySelector: () => avatarDiv },
          characterId,
          characterName
        );
        avatarDiv.dataset.characterId = String(characterId || "");
      }

      editor.renderLayoutCardControls(cardElement, action, characterName, {
        showToggleButton: true,
      });
    } else {
      return false;
    }

    const numberDiv = cardElement.querySelector(".card-sequence-number");
    if (numberDiv && globalIndex !== -1) {
      numberDiv.textContent = `#${globalIndex + 1}`;
    }
    return true;
  };

  return {
    renderSingleCard,
    updateCard,
    contextSignature: (configEntries) =>
      DataUtils.shallowSignature(configEntries),
  };
}
