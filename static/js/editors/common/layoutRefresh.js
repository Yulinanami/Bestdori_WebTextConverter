// 布局卡片的局部刷新
import { DOMUtils } from "@utils/DOMUtils.js";
import { state } from "@managers/stateManager.js";
import { DragHelper } from "@editors/common/DragHelper.js";
import { renderAvatar } from "@utils/avatarUtils.js";
import { buildNameMap } from "@utils/TimelineCardFactory.js";
import { resolveGroupRange, updateGroupHeader } from "@editors/common/groupHeaderUtils.js";

function captureMutationAnchor(editor, container, cardSelector, pendingPatch, actions) {
  const cards = Array.from(container.querySelectorAll(cardSelector));
  if (cards.length === 0) {
    return null;
  }

  let anchorCard = null;

  // 删卡时优先锚住目标附近还会留在列表里的卡，避免删除后视口突然上跳。
  if (pendingPatch.type === "delete") {
    const targetIndex = cards.findIndex(
      (cardElement) => cardElement.dataset.id === pendingPatch.actionId,
    );
    if (targetIndex >= 0) {
      anchorCard =
        cards[targetIndex + 1] ||
        cards[targetIndex - 1] ||
        cards[targetIndex];
    }
  } else {
    const mutationIndex = editor.findActionIndexById(pendingPatch.actionId, actions);
    if (mutationIndex >= 0) {
      anchorCard =
        cards.find(
          (cardElement) =>
            Number.parseInt(cardElement.dataset.actionIndex, 10) >= mutationIndex,
        ) ||
        cards[cards.length - 1];
    }
  }

  // 找不到更合适的卡时，退回当前视口里第一张可见卡。
  if (!anchorCard) {
    const containerRect = container.getBoundingClientRect();
    anchorCard =
      cards.find((cardElement) => {
        const rect = cardElement.getBoundingClientRect();
        return rect.bottom > containerRect.top && rect.top < containerRect.bottom;
      }) || cards[0];
  }

  return anchorCard
    ? {
        id: anchorCard.dataset.id,
        top: anchorCard.getBoundingClientRect().top,
      }
    : null;
}

function restoreMutationAnchor(container, cardSelector, anchor, fallbackScrollTop) {
  if (!anchor) {
    container.scrollTop = fallbackScrollTop;
    return;
  }

  requestAnimationFrame(() => {
    const restoredAnchor = Array.from(container.querySelectorAll(cardSelector)).find(
      (cardElement) => cardElement.dataset.id === anchor.id,
    );
    if (restoredAnchor) {
      container.scrollTop += restoredAnchor.getBoundingClientRect().top - anchor.top;
      return;
    }
    container.scrollTop = fallbackScrollTop;
  });
}

function getActiveGroupContext(container, activeGroupIndex, cardSelector) {
  const header = container.querySelector(
    `.timeline-group-header[data-group-idx="${activeGroupIndex}"]`,
  );
  if (!header) {
    return { header: null, nextHeader: null, cards: [] };
  }

  const cards = [];
  // 只取当前展开组头和下一个组头之间的卡片，局部增删只在这段里做。
  let nextNode = header.nextElementSibling;
  while (nextNode && !nextNode.classList.contains("timeline-group-header")) {
    if (nextNode.matches(cardSelector)) {
      cards.push(nextNode);
    }
    nextNode = nextNode.nextElementSibling;
  }

  return { header, nextHeader: nextNode, cards };
}

function refreshGroupHeaders(
  editor,
  container,
  totalGroups,
  groupSize,
  totalActions,
  activeGroupIndex,
  onGroupToggle,
) {
  const headers = Array.from(container.querySelectorAll(".timeline-group-header"));
  if (headers.length !== totalGroups) {
    return false;
  }

  headers.forEach((header, groupIndex) => {
    const { startNum, endNum } = resolveGroupRange(groupIndex, groupSize, totalActions);
    updateGroupHeader(header, {
      groupIndex,
      isActive: activeGroupIndex !== null && groupIndex === activeGroupIndex,
      startNum,
      endNum,
      onToggle: (index) => {
        const isOpening = editor.activeGroupIndex !== index;
        editor.activeGroupIndex = isOpening ? index : null;
        if (typeof onGroupToggle === "function") {
          onGroupToggle.call(editor, index, isOpening);
        }
      },
    });
  });

  return true;
}

// 给编辑器添加布局卡片局部刷新
export function attachLayoutRefresh(editor, options = {}) {
  const {
    containerKey,
    showToggleButton = false,
    cardSelector = ".talk-item, .layout-item",
    renderActionCard,
    onGroupToggle,
    onMutationApplied,
  } = options;

  const normalizeDetail = (detail) => {
    if (!detail) return "";
    if (typeof detail === "string") return detail;
    if (typeof detail.detail === "string") return detail.detail;
    try {
      return JSON.stringify(detail);
    } catch {
      return String(detail);
    }
  };

  Object.assign(editor, {
    pendingLayoutChange: null,
    pendingLayoutPatch: null,

    markLayoutChange(actionId, detail = null) {
      this.pendingLayoutChange = { actionId, detail };
    },

    markLayoutMutation(actionId, type = "delete", options = {}) {
      const { startIndex = null, source = null, detail = null } = options;
      this.pendingLayoutPatch = {
        actionId,
        type,
        startIndex,
        source,
        detail: normalizeDetail(detail),
      };
    },

    applyLayoutChange() {
      const pendingPatch = this.pendingLayoutChange;
      if (!pendingPatch) {
        return false;
      }
      this.pendingLayoutChange = null;

      const container = this.domCache?.[containerKey];
      if (!container) {
        return false;
      }

      const action = this.findActionById(pendingPatch.actionId);
      if (!action || action.type !== "layout") {
        return false;
      }

      const layoutCard = container.querySelector(
        `.layout-item[data-id="${pendingPatch.actionId}"]`,
      );
      if (!layoutCard) {
        return false;
      }

      layoutCard.dataset.id = action.id;
      layoutCard.dataset.layoutType = action.layoutType;
      DOMUtils.applyLayoutTypeClass(layoutCard, action.layoutType);

      const configEntries = state.currentConfig || {};
      const characterNameMap = buildNameMap(configEntries);
      const characterName =
        action.characterName || characterNameMap.get(action.characterId);
      const nameElement = layoutCard.querySelector(".speaker-name");
      if (nameElement) {
        nameElement.textContent =
          characterName || `未知角色 (ID: ${action.characterId ?? "?"})`;
      }

      const avatarElement = layoutCard.querySelector(".dialogue-avatar");
      if (avatarElement) {
        renderAvatar(avatarElement, action.characterId, characterName);
        avatarElement.dataset.characterId = String(action.characterId || "");
      }

      this.renderLayoutControls(layoutCard, action, characterName, {
        showToggleButton,
      });
      return true;
    },

    applyLayoutMutation() {
      const pendingPatch = this.pendingLayoutPatch;
      if (
        !pendingPatch ||
        (pendingPatch.type !== "add" && pendingPatch.type !== "delete")
      ) {
        return false;
      }
      this.pendingLayoutPatch = null;

      const container = this.domCache?.[containerKey];
      const actions = this.projectFileState.actions;
      if (!container) {
        return false;
      }

      const isGroupingEnabled = this.domCache.groupCheckbox.checked;
      const groupSize = this.groupSize;
      const shouldGroup = isGroupingEnabled && actions.length > groupSize;
      const hasGroupHeader = Boolean(
        container.querySelector(".timeline-group-header"),
      );
      const preservedScrollTop = container.scrollTop;
      const anchor = captureMutationAnchor(
        this,
        container,
        cardSelector,
        pendingPatch,
        actions,
      );
      const finishMutation = () => {
        if (typeof onMutationApplied === "function") {
          onMutationApplied.call(this, pendingPatch);
        }
        return true;
      };

      if (shouldGroup) {
        const totalActions = actions.length;
        const totalGroups = Math.ceil(totalActions / groupSize);
        let activeGroupIndex = this.activeGroupIndex;

        if (pendingPatch.type === "add") {
          const insertIndex = this.findActionIndexById(pendingPatch.actionId, actions);
          if (insertIndex >= 0) {
            activeGroupIndex = Math.floor(insertIndex / groupSize);
          }
        }
        if (activeGroupIndex === null && totalGroups > 0) {
          activeGroupIndex = 0;
        }
        if (
          activeGroupIndex !== null &&
          activeGroupIndex >= totalGroups &&
          totalGroups > 0
        ) {
          activeGroupIndex = totalGroups - 1;
        }
        this.activeGroupIndex = activeGroupIndex;

        const mutationIndex =
          pendingPatch.type === "add"
            ? this.findActionIndexById(pendingPatch.actionId, actions)
            : null;
        const headers = container.querySelectorAll(".timeline-group-header").length;
        const groupStartIndex = activeGroupIndex * groupSize;
        const groupEndIndex = Math.min(groupStartIndex + groupSize, totalActions);
        const groupContext = getActiveGroupContext(
          container,
          activeGroupIndex,
          cardSelector,
        );
        const isDeleteInActiveGroup = groupContext.cards.some(
          (cardElement) => cardElement.dataset.id === pendingPatch.actionId,
        );
        const isAddInActiveGroup =
          mutationIndex !== -1 &&
          mutationIndex !== null &&
          mutationIndex >= groupStartIndex &&
          mutationIndex < groupEndIndex;

        if (headers === totalGroups && groupContext.header) {
          if (pendingPatch.type === "add" && isAddInActiveGroup) {
            const localInsertIndex = mutationIndex - groupStartIndex;
            const insertedAction = actions[mutationIndex];
            const newCard = renderActionCard(this, insertedAction, mutationIndex);
            if (!newCard) {
              return false;
            }

            // 新插入的可见布局卡要立刻用真实高度，避免估高占位把视口顶偏。
            newCard.style.contentVisibility = "visible";
            newCard.style.containIntrinsicSize = "auto";

            // 同组新增时只插入这一张，并把被挤出当前组的尾卡移走。
            const referenceNode =
              groupContext.cards[localInsertIndex] || groupContext.nextHeader || null;
            container.insertBefore(newCard, referenceNode);

            const desiredCount = groupEndIndex - groupStartIndex;
            const updatedGroup = getActiveGroupContext(
              container,
              activeGroupIndex,
              cardSelector,
            );
            while (updatedGroup.cards.length > desiredCount) {
              updatedGroup.cards.pop()?.remove();
            }

            refreshGroupHeaders(
              this,
              container,
              totalGroups,
              groupSize,
              totalActions,
              activeGroupIndex,
              onGroupToggle,
            );
            DragHelper.syncCardOrderMeta({
              container,
              cardSelector,
              startIndex: Math.max(0, localInsertIndex),
              baseIndex: groupStartIndex,
            });
            restoreMutationAnchor(
              container,
              cardSelector,
              anchor,
              preservedScrollTop,
            );
            return finishMutation();
          }

          if (pendingPatch.type === "delete" && isDeleteInActiveGroup) {
            const localDeleteIndex = groupContext.cards.findIndex(
              (cardElement) => cardElement.dataset.id === pendingPatch.actionId,
            );
            if (localDeleteIndex >= 0) {
              groupContext.cards[localDeleteIndex].remove();

              // 同组删除后只把下一张应该补进当前组的尾卡补回来。
              const desiredCount = groupEndIndex - groupStartIndex;
              const updatedGroup = getActiveGroupContext(
                container,
                activeGroupIndex,
                cardSelector,
              );
              if (updatedGroup.cards.length < desiredCount) {
                const tailAction = actions[groupEndIndex - 1];
                if (
                  tailAction &&
                  !updatedGroup.cards.some(
                    (cardElement) => cardElement.dataset.id === tailAction.id,
                  )
                ) {
                  const tailCard = renderActionCard(
                    this,
                    tailAction,
                    groupEndIndex - 1,
                  );
                  if (!tailCard) {
                    return false;
                  }
                  container.insertBefore(tailCard, updatedGroup.nextHeader || null);
                }
              }

              refreshGroupHeaders(
                this,
                container,
                totalGroups,
                groupSize,
                totalActions,
                activeGroupIndex,
                onGroupToggle,
              );
              DragHelper.syncCardOrderMeta({
                container,
                cardSelector,
                startIndex: Math.max(0, localDeleteIndex),
                baseIndex: groupStartIndex,
              });
              restoreMutationAnchor(
                container,
                cardSelector,
                anchor,
                preservedScrollTop,
              );
              return finishMutation();
            }
          }
        }

        const fragment = document.createDocumentFragment();
        const headersInDom = Array.from(
          container.querySelectorAll(".timeline-group-header"),
        );
        for (let groupIndex = 0; groupIndex < totalGroups; groupIndex++) {
          const header = headersInDom[groupIndex]
            ? headersInDom[groupIndex].cloneNode(true)
            : document.createElement("div");
          const isActive =
            activeGroupIndex !== null && groupIndex === activeGroupIndex;
          const { startNum, endNum } = resolveGroupRange(
            groupIndex,
            groupSize,
            totalActions,
          );
          updateGroupHeader(header, {
            groupIndex,
            isActive,
            startNum,
            endNum,
            onToggle: (index) => {
              const isOpening = this.activeGroupIndex !== index;
              this.activeGroupIndex = isOpening ? index : null;
              if (typeof onGroupToggle === "function") {
                onGroupToggle.call(this, index, isOpening);
              }
            },
          });
          fragment.appendChild(header);

          if (isActive) {
            for (
              let actionIndex = startNum - 1;
              actionIndex < endNum;
              actionIndex++
            ) {
              const renderedCard = renderActionCard(
                this,
                actions[actionIndex],
                actionIndex,
              );
              if (!renderedCard) {
                return false;
              }
              fragment.appendChild(renderedCard);
            }
          }
        }

        container.replaceChildren(fragment);
        restoreMutationAnchor(container, cardSelector, anchor, preservedScrollTop);
        return finishMutation();
      }

      if (hasGroupHeader) {
        const fragment = document.createDocumentFragment();
        for (let index = 0; index < actions.length; index++) {
          const renderedCard = renderActionCard(this, actions[index], index);
          if (!renderedCard) {
            return false;
          }
          fragment.appendChild(renderedCard);
        }
        container.replaceChildren(fragment);
        restoreMutationAnchor(container, cardSelector, anchor, preservedScrollTop);
        return finishMutation();
      }

      if (pendingPatch.type === "add") {
        const insertIndex = this.findActionIndexById(pendingPatch.actionId, actions);
        if (insertIndex < 0) {
          return false;
        }

        const insertedAction = actions[insertIndex];
        const newCard = renderActionCard(this, insertedAction, insertIndex);
        if (!newCard) {
          return false;
        }

        // 新插入的可见布局卡要立刻用真实高度，避免估高占位把视口顶偏。
        newCard.style.contentVisibility = "visible";
        newCard.style.containIntrinsicSize = "auto";

        const cards = container.querySelectorAll(cardSelector);
        const referenceNode = cards[insertIndex] || null;
        container.insertBefore(newCard, referenceNode);
        DragHelper.syncCardOrderMeta({
          container,
          cardSelector,
          startIndex: insertIndex,
          baseIndex: 0,
        });
        restoreMutationAnchor(container, cardSelector, anchor, preservedScrollTop);
        return finishMutation();
      }

      const cards = Array.from(container.querySelectorAll(cardSelector));
      const targetIndex = cards.findIndex(
        (cardElement) => cardElement.dataset.id === pendingPatch.actionId,
      );
      if (targetIndex < 0) {
        return false;
      }

      cards[targetIndex].remove();
      DragHelper.syncCardOrderMeta({
        container,
        cardSelector,
        startIndex: targetIndex,
        baseIndex: 0,
      });
      restoreMutationAnchor(container, cardSelector, anchor, preservedScrollTop);
      return finishMutation();
    },
  });
}
