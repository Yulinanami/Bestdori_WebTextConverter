import {
  createTimelineRenderCache,
  renderIncrementalTimeline,
} from "@utils/IncrementalTimelineRenderer.js";
import { DataUtils } from "@utils/DataUtils.js";
import { DOMUtils } from "@utils/DOMUtils.js";
import {
  createTalkCard,
  createLayoutCard,
} from "@utils/TimelineCardFactory.js";
import { editorService } from "@services/EditorService.js";

/**
 * 时间轴渲染模块，负责普通与分组模式的卡片绘制。
 */
const timelineCache = createTimelineRenderCache();

export function renderTimeline(editor) {
  const timeline = editor.domCache.timeline;
  if (!timeline) return;

  const isGroupingEnabled = editor.domCache.groupCheckbox?.checked || false;
  const actions = editor.projectFileState.actions || [];
  const groupSize = 50;
  const templates =
    editor.domCache.templates ||
    (editor.domCache.templates = {
      talk: document.getElementById("timeline-talk-card-template"),
      layout: document.getElementById("timeline-layout-card-template"),
    });
  const configEntries = editorService.getCurrentConfig() || {};
  const configSignature = DataUtils.shallowSignature(configEntries);
  const characterNameMap = new Map(
    Object.entries(configEntries).flatMap(([name, ids]) =>
      ids.map((id) => [id, name])
    )
  );

  const renderFooter = (card, action) => {
    const footer = card.querySelector(".timeline-item-footer");
    if (!footer) return;
    DOMUtils.clearElement(footer);

    if (editor._actionHasExpressionData(action)) {
      // 复用统一的分配渲染逻辑，避免两套实现
      editor.showExpressionSetupUI(card);
      return;
    }

    const setupButton = DOMUtils.createButton(
      "设置动作/表情",
      "btn btn-secondary btn-sm setup-expressions-btn"
    );
    footer.appendChild(setupButton);
  };

  const renderSingleCard = (action, globalIndex = -1) => {
    let cardElement;

    if (action.type === "talk") {
      cardElement = createTalkCard(action, {
        template: templates.talk,
        templateId: templates.talk?.id || "text-snippet-card-template",
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
                showToggleButton: false,
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
    renderFooter(card, action);

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
          avatarDiv.dataset.characterId !== String(firstSpeaker.characterId || "")
        ) {
          editorService.updateCharacterAvatar(
            { querySelector: () => avatarDiv },
            firstSpeaker.characterId,
            firstSpeaker.name
          );
          avatarDiv.dataset.characterId = String(firstSpeaker.characterId || "");
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
    } else {
      return false;
    }

    const numberDiv = card.querySelector(".card-sequence-number");
    if (numberDiv && globalIndex !== -1) {
      numberDiv.textContent = `#${globalIndex + 1}`;
    }

    renderFooter(card, action);
    return true;
  };

  renderIncrementalTimeline({
    container: timeline,
    actions,
    cache: timelineCache,
    renderCard: renderSingleCard,
    updateCard,
    signatureResolver: DataUtils.actionSignature,
    groupingEnabled: isGroupingEnabled,
    groupSize,
    activeGroupIndex: editor.activeGroupIndex,
    contextSignature: configSignature,
    onGroupToggle: (index) => {
      const isOpening = editor.activeGroupIndex !== index;
      editor.activeGroupIndex = isOpening ? index : null;
      editor.renderTimeline();

      if (isOpening) {
        setTimeout(() => {
          const scrollContainer = editor.domCache.timeline;
          const header = scrollContainer?.querySelector(
            `.timeline-group-header[data-group-idx="${index}"]`
          );
          if (
            scrollContainer &&
            header &&
            scrollContainer.scrollTop !== header.offsetTop - 110
          ) {
            scrollContainer.scrollTo({
              top: header.offsetTop - 110,
              behavior: "smooth",
            });
          }
        }, 0);
      }
    },
  });
}
