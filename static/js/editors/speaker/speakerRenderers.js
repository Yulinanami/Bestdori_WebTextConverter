import { DOMUtils } from "@utils/DOMUtils.js";
import { editorService } from "@services/EditorService.js";
import { configUI } from "@managers/config/configUI.js";

// 把speakers数组压成一个字符串 key（用于判断卡片是否还能“增量更新”）
function setSpeakerKey(card, speakers = []) {
  const speakerKey = speakers
    .map((speaker) => `${speaker.characterId}:${speaker.name}`)
    .join("|");
  card.dataset.speakerKey = speakerKey;
}

export function createSpeakerRenderers(
  editor,
  { templates, characterNameMap },
) {
  // renderSingleCard负责画一个卡片，updateCard负责就地更新卡片
  const renderSingleCard = (action, globalIndex = -1) => {
    let cardElement;

    if (action.type === "talk") {
      cardElement = templates.talk.content.cloneNode(true);
      const dialogueItem = cardElement.firstElementChild;
      dialogueItem.dataset.id = action.id;
      const avatarContainer = dialogueItem.querySelector(
        ".speaker-avatar-container",
      );
      const avatarDiv = dialogueItem.querySelector(".dialogue-avatar");
      const speakerNameDiv = dialogueItem.querySelector(".speaker-name");
      const multiSpeakerBadge = dialogueItem.querySelector(
        ".multi-speaker-badge",
      );

      if (action.speakers && action.speakers.length > 0) {
        const firstSpeaker = action.speakers[0];
        avatarContainer.classList.remove("hidden");
        avatarContainer.style.display = "flex";
        speakerNameDiv.classList.remove("hidden");
        dialogueItem.classList.remove("narrator");
        configUI.updateConfigAvatar(
          editorService.configManager,
          { querySelector: () => avatarDiv },
          firstSpeaker.characterId,
          firstSpeaker.name,
        );
        const allSpeakerNames = action.speakers
          .map((speaker) => speaker.name)
          .join(" & ");
        speakerNameDiv.textContent = allSpeakerNames;

        if (action.speakers.length > 1) {
          multiSpeakerBadge.classList.remove("hidden");
          multiSpeakerBadge.style.display = "flex";
          multiSpeakerBadge.textContent = `+${action.speakers.length - 1}`;
          avatarContainer.style.cursor = "pointer";
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
    } else if (action.type === "layout") {
      cardElement = templates.layout.content.cloneNode(true);
      const layoutItem = cardElement.firstElementChild;
      layoutItem.dataset.id = action.id;
      layoutItem.dataset.layoutType = action.layoutType;
      layoutItem.classList.remove("dialogue-item");
      layoutItem.classList.add("layout-item");

      DOMUtils.applyLayoutTypeClass(layoutItem, action.layoutType);

      const characterId = action.characterId;
      const characterName =
        action.characterName || characterNameMap.get(characterId);

      layoutItem.querySelector(".speaker-name").textContent =
        characterName || `未知角色 (ID: ${characterId})`;
      const avatarDiv = layoutItem.querySelector(".dialogue-avatar");
      configUI.updateConfigAvatar(
        editorService.configManager,
        { querySelector: () => avatarDiv },
        characterId,
        characterName,
      );
      editor.renderLayoutCardControls(cardElement, action, characterName, {
        showToggleButton: false,
      });
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

    if (renderedCard.classList.contains("dialogue-item")) {
      setSpeakerKey(renderedCard, action.speakers || []);
    }
    return renderedCard;
  };

  const updateCard = (action, cardElement, globalIndex = -1) => {
    if (!cardElement) return false;
    if (
      action.type === "talk" &&
      cardElement.classList.contains("dialogue-item")
    ) {
      const avatarContainer = cardElement.querySelector(".speaker-avatar-container");
      const avatarDiv = cardElement.querySelector(".dialogue-avatar");
      const speakerNameDiv = cardElement.querySelector(".speaker-name");
      const multiSpeakerBadge = cardElement.querySelector(".multi-speaker-badge");
      const dialogueText = cardElement.querySelector(".dialogue-text");
      const speakerKey = cardElement.dataset.speakerKey || "";
      const nextSpeakerKey = (action.speakers || [])
        .map((speaker) => `${speaker.characterId}:${speaker.name}`)
        .join("|");

      if (speakerKey !== nextSpeakerKey) {
        return false;
      }

      if (action.speakers && action.speakers.length > 0) {
        const firstSpeaker = action.speakers[0];
        if (avatarContainer) {
          avatarContainer.classList.remove("hidden");
          avatarContainer.style.display = "flex";
        }
        if (speakerNameDiv) {
          speakerNameDiv.classList.remove("hidden");
          speakerNameDiv.textContent = action.speakers
            .map((speaker) => speaker.name)
            .join(" & ");
        }
        cardElement.classList.remove("narrator");
        if (avatarDiv) {
          DOMUtils.clearElement(avatarDiv);
          avatarDiv.classList.remove("fallback");
          avatarDiv.textContent = "";
          configUI.updateConfigAvatar(
            editorService.configManager,
            { querySelector: () => avatarDiv },
            firstSpeaker.characterId,
            firstSpeaker.name,
          );
          avatarDiv.dataset.characterId = String(
            firstSpeaker.characterId || "",
          );
        }

        if (action.speakers.length > 1) {
          if (multiSpeakerBadge) {
            multiSpeakerBadge.classList.remove("hidden");
            multiSpeakerBadge.style.display = "flex";
            multiSpeakerBadge.textContent = `+${action.speakers.length - 1}`;
          }
          if (avatarContainer) avatarContainer.style.cursor = "pointer";
        } else if (multiSpeakerBadge) {
          multiSpeakerBadge.classList.add("hidden");
          if (avatarContainer) avatarContainer.style.cursor = "default";
        }
      } else {
        if (avatarContainer) avatarContainer.classList.add("hidden");
        if (speakerNameDiv) speakerNameDiv.classList.add("hidden");
        if (multiSpeakerBadge) multiSpeakerBadge.classList.add("hidden");
        cardElement.classList.add("narrator");
        if (avatarDiv) {
          DOMUtils.clearElement(avatarDiv);
          avatarDiv.classList.add("fallback");
          avatarDiv.textContent = "N";
          avatarDiv.dataset.characterId = "";
        }
      }

      if (dialogueText) {
        dialogueText.textContent = action.text;
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
      const nameEl = cardElement.querySelector(".speaker-name");
      if (nameEl) {
        nameEl.textContent = characterName || `未知角色 (ID: ${characterId})`;
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
          characterName,
        );
        avatarDiv.dataset.characterId = String(characterId || "");
      }

      editor.renderLayoutCardControls(cardElement, action, characterName, {
        showToggleButton: false,
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

  return { renderSingleCard, updateCard };
}
