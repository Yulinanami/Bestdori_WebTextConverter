// 布局卡片的局部刷新
import { DOMUtils } from "@utils/DOMUtils.js";
import { state } from "@managers/stateManager.js";
import { DragHelper } from "@editors/common/DragHelper.js";
import { renderAvatar } from "@utils/avatarUtils.js";
import { buildNameMap } from "@utils/TimelineCardFactory.js";
import { resolveGroupRange, updateGroupHeader } from "@editors/common/groupHeaderUtils.js";

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
  // 把详情转成文字
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

    // 记录布局字段变化
    markLayoutChange(actionId, detail = null) {
      this.pendingLayoutChange = { actionId, detail };
    },

    // 记录布局卡片增删
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

    // 尝试只更新一张布局卡片
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
        `.layout-item[data-id="${pendingPatch.actionId}"]`
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

    // 尝试只处理布局卡片增删
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
        container.querySelector(".timeline-group-header")
      );
      const preservedScrollTop = container.scrollTop;
      const finishMutation = () => {
        if (typeof onMutationApplied === "function") {
          onMutationApplied.call(this, pendingPatch);
        }
        return true;
      };

      if (shouldGroup) {
        // 分组模式下只重建当前展开组
        // 分组模式下只重建当前组
        const totalActions = actions.length;
        const totalGroups = Math.ceil(totalActions / groupSize);
        const headers = Array.from(
          container.querySelectorAll(".timeline-group-header")
        );

        let activeGroupIndex = this.activeGroupIndex;
        if (pendingPatch.type === "add") {
          // 新增卡片时优先切到命中的那一组
          const insertIndex = this.findActionIndexById(
            pendingPatch.actionId,
            actions,
          );
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

        const fragment = document.createDocumentFragment();

        // 先重建所有组头 再只渲染当前展开组
        for (let groupIndex = 0; groupIndex < totalGroups; groupIndex++) {
          const header = headers[groupIndex]
            ? headers[groupIndex].cloneNode(true)
            : document.createElement("div");
          const isActive =
            activeGroupIndex !== null && groupIndex === activeGroupIndex;
          const { startNum, endNum } = resolveGroupRange(
            groupIndex,
            groupSize,
            totalActions
          );
          updateGroupHeader(header, {
            groupIndex,
            isActive,
            startNum,
            endNum,
            // 切换分组时同步展开状态再重画当前列表
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
        container.scrollTop = preservedScrollTop;
        return finishMutation();
      }

      // 组数掉回普通模式时直接整列表重画
      // 分组数量不够时切回普通列表
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
        container.scrollTop = preservedScrollTop;
        return finishMutation();
      }

      // 普通模式下再按增删类型只改命中的卡片
      if (pendingPatch.type === "add") {
        const insertIndex = this.findActionIndexById(
          pendingPatch.actionId,
          actions,
        );
        if (insertIndex < 0) {
          return false;
        }
        const insertedAction = actions[insertIndex];
        const newCard = renderActionCard(this, insertedAction, insertIndex);
        if (!newCard) {
          return false;
        }

        const cards = container.querySelectorAll(cardSelector);
        const referenceNode = cards[insertIndex] || null;
        container.insertBefore(newCard, referenceNode);
        DragHelper.syncCardOrderMeta({
          container,
          cardSelector,
          startIndex: insertIndex,
          baseIndex: 0,
        });
        return finishMutation();
      }

      // 普通模式下直接删卡片
      const cards = Array.from(container.querySelectorAll(cardSelector));
      const targetIndex = cards.findIndex(
        (cardElement) => cardElement.dataset.id === pendingPatch.actionId
      );
      if (targetIndex < 0) {
        return false;
      }

      cards[targetIndex].remove();
      DragHelper.syncCardOrderMeta({
        container,
        cardSelector,
        startIndex: Number.isInteger(pendingPatch.startIndex)
          ? pendingPatch.startIndex
          : targetIndex,
        baseIndex: 0,
      });
      return finishMutation();
    },
  });
}
