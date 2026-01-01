import { DOMUtils } from "@utils/DOMUtils.js";
import { DataUtils } from "@utils/DataUtils.js";
import {
  createTalkCard,
  createLayoutCard,
} from "@utils/TimelineCardFactory.js";
import { editorService } from "@services/EditorService.js";

export function createLive2dRenderers(editor, { templates, characterNameMap }) {
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

    const card =
      cardElement?.nodeType === Node.DOCUMENT_FRAGMENT_NODE
        ? cardElement.firstElementChild
        : cardElement;
    if (!card) return null;

    const numberDiv = card.querySelector(".card-sequence-number");
    if (numberDiv && globalIndex !== -1) {
      numberDiv.textContent = `#${globalIndex + 1}`;
    }
    return card;
  };

  const updateCard = (action, card, globalIndex = -1) => {
    if (!card) return false;
    if (action.type === "talk" && card.classList.contains("talk-item")) {
      const nameDiv = card.querySelector(".speaker-name");
      const avatarDiv = card.querySelector(".dialogue-avatar");
      const preview = card.querySelector(".dialogue-preview-text");

      if (action.speakers && action.speakers.length > 0) {
        const firstSpeaker = action.speakers[0];
        if (nameDiv) {
          nameDiv.textContent = action.speakers.map((s) => s.name).join(" & ");
        }
        if (
          avatarDiv &&
          avatarDiv.dataset.characterId !==
            String(firstSpeaker.characterId || "")
        ) {
          editorService.updateCharacterAvatar(
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
      card.classList.contains("layout-item")
    ) {
      card.dataset.id = action.id;
      card.dataset.layoutType = action.layoutType;
      DOMUtils.applyLayoutTypeClass(card, action.layoutType);

      const characterId = action.characterId;
      const characterName =
        action.characterName || characterNameMap.get(action.characterId);
      const nameDiv = card.querySelector(".speaker-name");
      if (nameDiv) {
        nameDiv.textContent =
          characterName || `未知角色 (ID: ${characterId ?? "?"})`;
      }

      const avatarDiv = card.querySelector(".dialogue-avatar");
      if (
        avatarDiv &&
        avatarDiv.dataset.characterId !== String(characterId || "")
      ) {
        editorService.updateCharacterAvatar(
          { querySelector: () => avatarDiv },
          characterId,
          characterName
        );
        avatarDiv.dataset.characterId = String(characterId || "");
      }

      editor.renderLayoutCardControls(card, action, characterName, {
        showToggleButton: true,
      });
    } else {
      return false;
    }

    const numberDiv = card.querySelector(".card-sequence-number");
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
