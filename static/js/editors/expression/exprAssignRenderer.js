// 渲染动作表情分配区
import { DOMUtils } from "@utils/DOMUtils.js";
import { configManager } from "@managers/configManager.js";
import { renderAvatar } from "@utils/avatarUtils.js";

function resolveCharacterName(characterId, fallbackName = "") {
  return fallbackName || configManager.findCharName(characterId) || `ID:${characterId}`;
}

function buildSummaryChip(label, value, isEmpty = false) {
  return DOMUtils.createElement(
    "span",
    {
      className: `expr-summary-chip${isEmpty ? " is-empty" : ""}`,
    },
    `${label}${value}`
  );
}

function buildSummaryRow(name, motion, expression, delay) {
  return DOMUtils.createElement("div", { className: "expr-summary-row" }, [
    DOMUtils.createElement("span", { className: "expr-summary-name" }, name),
    buildSummaryChip("动作 ", motion || "--", !motion),
    buildSummaryChip("表情 ", expression || "--", !expression),
    buildSummaryChip("延时 ", `${delay || 0}s`),
  ]);
}

// 分配区显示
export const assignUI = {
  // 同步卡片右上角的编辑按钮，布局卡会并进布局按钮排，对话卡保持单独悬浮
  syncTriggerButton(editor, cardElement, action, isExpanded) {
    const actionButtons = cardElement.querySelector(".layout-card-action-buttons");
    let triggerButton = cardElement.querySelector(".expr-card-trigger");
    if (!triggerButton) {
      triggerButton = DOMUtils.createElement("button", {
        className: "btn btn-icon-action expr-card-trigger",
        title: "",
        type: "button",
      });
      triggerButton.appendChild(
        DOMUtils.createElement(
          "span",
          { className: "material-symbols-outlined" },
          "edit"
        )
      );
      // 布局卡把动作表情按钮插进右上角按钮排
      const deleteButton = actionButtons?.querySelector(".layout-remove-btn");
      if (actionButtons) {
        if (deleteButton) {
          actionButtons.insertBefore(triggerButton, deleteButton);
        } else {
          actionButtons.appendChild(triggerButton);
        }
      } else {
        cardElement.appendChild(triggerButton);
      }
    }

    if (actionButtons) {
      // 布局卡走右上角按钮排 不再走单独悬浮定位
      triggerButton.classList.remove(
        "timeline-hover-trigger",
        "timeline-hover-trigger-open"
      );
    } else {
      triggerButton.classList.add("timeline-hover-trigger");
    }
    actionButtons?.classList.toggle("card-action-buttons-open", isExpanded);

    const icon = triggerButton.querySelector(".material-symbols-outlined");
    const hasData = editor.hasExpressionData(action);
    const buttonTitle = isExpanded
      ? "收起动作/表情编辑"
      : hasData
        ? "编辑动作/表情"
        : action.type === "talk"
          ? "添加角色动作/表情"
          : "添加动作/表情";

    triggerButton.title = buttonTitle;
    triggerButton.setAttribute("aria-label", buttonTitle);
    if (!actionButtons) {
      triggerButton.classList.toggle("timeline-hover-trigger-open", isExpanded);
    }
    if (icon) {
      icon.textContent = isExpanded ? "expand_less" : "edit";
    }
  },

  // 把已配置的动作/表情压成轻量摘要，卡片收起时也能一眼看出配置内容
  buildSummary(action) {
    if (action.type === "layout") {
      if (!action.initialState && typeof action.delay !== "number") {
        return null;
      }
      return DOMUtils.createElement("div", { className: "expr-footer-summary" }, [
        buildSummaryRow(
          resolveCharacterName(action.characterId, action.characterName),
          action.initialState?.motion || "",
          action.initialState?.expression || "",
          action.delay || 0
        ),
      ]);
    }

    if (!Array.isArray(action.motions) || action.motions.length === 0) {
      return null;
    }

    return DOMUtils.createElement(
      "div",
      { className: "expr-footer-summary" },
      action.motions.map((motionData) =>
        buildSummaryRow(
          resolveCharacterName(motionData.character),
          motionData.motion || "",
          motionData.expression || "",
          motionData.delay || 0
        )
      )
    );
  },

  // 刷新卡片底部
  renderCardFooter(editor, cardElement, options = {}) {
    const { action = null } = options;
    const actionId = cardElement?.dataset?.id;
    if (!actionId) return false;

    const resolvedAction =
      action || editor.findActionById(actionId);
    if (!resolvedAction) return false;

    const footer = cardElement.querySelector(".timeline-item-footer");
    if (!footer) return false;

    const isExpanded = editor.activeExpressionCardId === actionId;
    const summary = assignUI.buildSummary(resolvedAction);
    assignUI.syncTriggerButton(editor, cardElement, resolvedAction, isExpanded);

    DOMUtils.clearElement(footer);

    if (summary) {
      footer.appendChild(summary);
    }

    if (isExpanded) {
      assignUI.appendSetupUI(editor, footer, resolvedAction);
    }

    if (!summary && !isExpanded) {
      footer.className = "timeline-item-footer expr-footer-empty";
      return true;
    }

    footer.className = `timeline-item-footer ${
      isExpanded ? "expr-footer-expanded" : "expr-footer-summary-only"
    }`;
    return true;
  },

  // 在 footer 里补上编辑控件
  appendSetupUI(editor, footer, resolvedAction) {
    if (resolvedAction.type === "layout") {
      const assignmentsContainer = DOMUtils.createElement("div", {
        className: "motion-assignments-container",
      });
      assignmentsContainer.dataset.actionId = resolvedAction.id;

      const characterInfo = {
        id: resolvedAction.characterId,
        name:
          resolvedAction.characterName ||
          configManager.findCharName(resolvedAction.characterId),
      };

      if (characterInfo.name) {
        const initialState = resolvedAction.initialState || {};
        const motionData = {
          character: characterInfo.id,
          motion: initialState.motion || "",
          expression: initialState.expression || "",
          delay: resolvedAction.delay || 0,
        };

        const assignmentItem = assignUI.createAssignmentItem(
          editor,
          resolvedAction,
          motionData,
          0,
          true
        );
        assignmentsContainer.appendChild(assignmentItem);
      }

      footer.appendChild(assignmentsContainer);
      return;
    }

    const assignmentsContainer = DOMUtils.createElement("div", {
      className: "motion-assignments-container",
    });
    assignmentsContainer.dataset.actionId = resolvedAction.id;

    if (resolvedAction.motions && resolvedAction.motions.length > 0) {
      resolvedAction.motions.forEach((motionData, index) => {
        const assignmentItem = assignUI.createAssignmentItem(
          editor,
          resolvedAction,
          motionData,
          index
        );
        assignmentsContainer.appendChild(assignmentItem);
      });
    }

    const characterSelector = assignUI.buildCharPicker(
      editor,
      resolvedAction
    );

    footer.appendChild(assignmentsContainer);
    footer.appendChild(characterSelector);

    if (resolvedAction.motions?.length) {
      // 已经有角色配置时 继续保留追加角色入口
      const setupButton = DOMUtils.createButton(
        "添加角色动作/表情",
        "btn btn-secondary btn-sm setup-expressions-btn"
      );
      footer.appendChild(setupButton);
      characterSelector.style.display = "none";
      return;
    }

    characterSelector.style.display = "flex";
  },

  // 创建角色选择列表
  buildCharPicker(editor, action) {
    const template = document.getElementById(
      "motion-character-selector-template"
    );
    const selectorFragment = template.content.cloneNode(true);

    const selectorContainer = DOMUtils.createElement("div");
    selectorContainer.appendChild(selectorFragment);
    const selector = selectorContainer.firstElementChild;

    const listContainer = selector.querySelector(".character-selector-list");

    let availableCharacters = [];
    if (action.type === "talk") {
      availableCharacters = editor.listStagedChars();
    } else if (action.type === "layout") {
      const characterInfo = {
        id: action.characterId,
        name:
          action.characterName || configManager.findCharName(action.characterId),
      };
      if (characterInfo.name) {
        availableCharacters = [characterInfo];
      }
    }

    availableCharacters.forEach((characterInfo) => {
      const optionTemplate = document.getElementById(
        "motion-character-option-template"
      );
      const option = optionTemplate.content.cloneNode(true);
      const optionElement = option.querySelector(".character-selector-item");

      optionElement.dataset.characterId = characterInfo.id;
      optionElement.dataset.characterName = characterInfo.name;

      const avatarDiv = option.querySelector(".dialogue-avatar");
      renderAvatar(avatarDiv, characterInfo.id, characterInfo.name);

      option.querySelector(".character-name").textContent = characterInfo.name;
      listContainer.appendChild(option);
    });

    return selector;
  },

  // 创建一条分配项
  createAssignmentItem(
    editor,
    action,
    motionData,
    index,
    isLayoutCard = false
  ) {
    const template = document.getElementById("motion-assignment-item-template");
    const itemFragment = template.content.cloneNode(true);

    const itemContainer = DOMUtils.createElement("div");
    itemContainer.appendChild(itemFragment);
    const itemElement = itemContainer.firstElementChild;

    const characterName = configManager.findCharName(motionData.character);

    itemElement.dataset.characterId = motionData.character;
    itemElement.dataset.characterName = characterName;
    itemElement.dataset.assignmentIndex = index;
    itemElement.dataset.actionId = action.id;

    const avatarDiv = itemElement.querySelector(".dialogue-avatar");
    renderAvatar(avatarDiv, motionData.character, characterName);
    itemElement.querySelector(".character-name").textContent = characterName;

    const motionValue = itemElement.querySelector(
      ".motion-drop-zone .drop-zone-value"
    );
    const motionClearButton = itemElement.querySelector(
      ".motion-drop-zone .clear-state-btn"
    );
    motionValue.textContent = motionData.motion || "--";
    if (motionClearButton) {
      DOMUtils.toggleDisplay(motionClearButton, !!motionData.motion);
    }

    const expressionValue = itemElement.querySelector(
      ".expression-drop-zone .drop-zone-value"
    );
    const expressionClearButton = itemElement.querySelector(
      ".expression-drop-zone .clear-state-btn"
    );
    expressionValue.textContent = motionData.expression || "--";
    if (expressionClearButton) {
      DOMUtils.toggleDisplay(expressionClearButton, !!motionData.expression);
    }

    const delayInput = itemElement.querySelector(".assignment-delay-input");
    delayInput.value = motionData.delay || 0;

    editor.initAssignSortables(itemElement, isLayoutCard);

    return itemElement;
  },
};
