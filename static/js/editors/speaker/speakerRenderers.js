import { DOMUtils } from "@utils/DOMUtils.js";
import { editorService } from "@services/EditorService.js";

// 把speakers数组压成一个字符串 key（用于判断卡片是否还能“增量更新”）
function setSpeakerKey(card, speakers = []) {
  const key = speakers.map((s) => `${s.characterId}:${s.name}`).join("|");
  card.dataset.speakerKey = key;
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
        editorService.updateCharacterAvatar(
          { querySelector: () => avatarDiv },
          firstSpeaker.characterId,
          firstSpeaker.name,
        );
        const allNames = action.speakers.map((s) => s.name).join(" & ");
        speakerNameDiv.textContent = allNames;

        if (action.speakers.length > 1) {
          multiSpeakerBadge.classList.remove("hidden");
          multiSpeakerBadge.style.display = "flex";
          multiSpeakerBadge.textContent = `+${action.speakers.length - 1}`;
          avatarContainer.style.cursor = "pointer";
          avatarContainer.addEventListener("click", (e) => {
            e.stopPropagation();
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
      const item = cardElement.firstElementChild;
      item.dataset.id = action.id;
      item.dataset.layoutType = action.layoutType;
      item.classList.remove("dialogue-item");
      item.classList.add("layout-item");

      DOMUtils.applyLayoutTypeClass(item, action.layoutType);

      const characterId = action.characterId;
      const characterName =
        action.characterName || characterNameMap.get(characterId);

      item.querySelector(".speaker-name").textContent =
        characterName || `未知角色 (ID: ${characterId})`;
      const avatarDiv = item.querySelector(".dialogue-avatar");
      editorService.updateCharacterAvatar(
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

    const card =
      cardElement?.nodeType === Node.DOCUMENT_FRAGMENT_NODE
        ? cardElement.firstElementChild
        : cardElement;
    if (!card) return null;

    const numberDiv = card.querySelector(".card-sequence-number");
    if (numberDiv && globalIndex !== -1) {
      numberDiv.textContent = `#${globalIndex + 1}`;
    }

    if (card.classList.contains("dialogue-item")) {
      setSpeakerKey(card, action.speakers || []);
    }
    return card;
  };

  const updateCard = (action, card, globalIndex = -1) => {
    if (!card) return false;
    if (action.type === "talk" && card.classList.contains("dialogue-item")) {
      const avatarContainer = card.querySelector(".speaker-avatar-container");
      const avatarDiv = card.querySelector(".dialogue-avatar");
      const speakerNameDiv = card.querySelector(".speaker-name");
      const multiSpeakerBadge = card.querySelector(".multi-speaker-badge");
      const dialogueText = card.querySelector(".dialogue-text");
      const speakerKey = card.dataset.speakerKey || "";
      const nextSpeakerKey = (action.speakers || [])
        .map((s) => `${s.characterId}:${s.name}`)
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
            .map((s) => s.name)
            .join(" & ");
        }
        card.classList.remove("narrator");
        if (avatarDiv) {
          DOMUtils.clearElement(avatarDiv);
          avatarDiv.classList.remove("fallback");
          avatarDiv.textContent = "";
          editorService.updateCharacterAvatar(
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
        card.classList.add("narrator");
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
      card.classList.contains("layout-item")
    ) {
      card.dataset.id = action.id;
      card.dataset.layoutType = action.layoutType;
      DOMUtils.applyLayoutTypeClass(card, action.layoutType);

      const characterId = action.characterId;
      const characterName =
        action.characterName || characterNameMap.get(action.characterId);
      const nameEl = card.querySelector(".speaker-name");
      if (nameEl) {
        nameEl.textContent = characterName || `未知角色 (ID: ${characterId})`;
      }
      const avatarDiv = card.querySelector(".dialogue-avatar");
      if (
        avatarDiv &&
        avatarDiv.dataset.characterId !== String(characterId || "")
      ) {
        editorService.updateCharacterAvatar(
          { querySelector: () => avatarDiv },
          characterId,
          characterName,
        );
        avatarDiv.dataset.characterId = String(characterId || "");
      }

      editor.renderLayoutCardControls(card, action, characterName, {
        showToggleButton: false,
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

  return { renderSingleCard, updateCard };
}
