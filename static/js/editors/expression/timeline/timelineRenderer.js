import { DOMUtils } from "@utils/DOMUtils.js";
import {
  createTimelineRenderCache,
  renderIncrementalTimeline,
} from "@utils/IncrementalTimelineRenderer.js";
import { DataUtils } from "@utils/DataUtils.js";
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

    const footer = card.querySelector(".timeline-item-footer");
    if (editor._actionHasExpressionData(action)) {
      if (action.type === "talk") {
        const assignmentsContainer = DOMUtils.createElement("div", {
          className: "motion-assignments-container",
        });
        assignmentsContainer.dataset.actionId = action.id;

        if (action.motions && action.motions.length > 0) {
          action.motions.forEach((motionData, index) => {
            const assignmentItem = editor._createAssignmentItem(
              action,
              motionData,
              index
            );
            assignmentsContainer.appendChild(assignmentItem);
          });
        }

        const characterSelector = editor._createCharacterSelector(action);
        characterSelector.style.display = "none";

        const setupButton = DOMUtils.createButton(
          "设置动作/表情",
          "btn btn-secondary btn-sm setup-expressions-btn"
        );

        DOMUtils.clearElement(footer);
        footer.appendChild(assignmentsContainer);
        footer.appendChild(characterSelector);
        footer.appendChild(setupButton);
      } else if (action.type === "layout") {
        const assignmentsContainer = DOMUtils.createElement("div", {
          className: "motion-assignments-container",
        });
        assignmentsContainer.dataset.actionId = action.id;

        const char = {
          id: action.characterId,
          name:
            action.characterName ||
            editorService.getCharacterNameById(action.characterId),
        };

        if (char.name) {
          const motionData = {
            character: char.id,
            motion: action.initialState?.motion || "",
            expression: action.initialState?.expression || "",
            delay: action.delay || 0,
          };

          const assignmentItem = editor._createAssignmentItem(
            action,
            motionData,
            0,
            true
          );
          assignmentsContainer.appendChild(assignmentItem);
        }

        DOMUtils.clearElement(footer);
        footer.appendChild(assignmentsContainer);
      }
    } else {
      DOMUtils.clearElement(footer);
      const setupButton = DOMUtils.createButton(
        "设置动作/表情",
        "btn btn-secondary btn-sm setup-expressions-btn"
      );
      footer.appendChild(setupButton);
    }

    return card;
  };

  const updateCard = () => false;

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
