import { DOMUtils } from "@utils/DOMUtils.js";
import { editorService } from "@services/EditorService.js";
import { configUI } from "@managers/config/configUI.js";
import { DragHelper } from "@editors/common/DragHelper.js";

// 布局卡片字段变更后的局部刷新：优先就地更新目标卡片，失败再回退全量渲染。
export function attachLayoutCardLocalRefresh(editor, options = {}) {
  const {
    getContainer,
    showToggleButton = false,
    cardSelector = ".talk-item, .layout-item",
    renderActionCard,
    onGroupToggle,
  } = options;
  // 把不同 detail 入参统一转成字符串，方便日志直接打印。
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
    pendingLayoutPropertyRender: null,
    pendingLayoutMutationRender: null,

    // 标记“下次渲染优先局部更新这张布局卡片”。
    markLayoutPropertyRender(actionId, detail = null) {
      this.pendingLayoutPropertyRender = { actionId, detail };
    },

    // 标记“下次渲染优先局部删除这张布局卡片”。
    markLayoutMutationRender(actionId, type = "delete", options = {}) {
      const { startIndex = null, source = null, detail = null } = options;
      this.pendingLayoutMutationRender = {
        actionId,
        type,
        startIndex,
        source,
        detail: normalizeDetail(detail),
      };
    },

    // 尝试把布局字段改动就地应用到目标卡片。
    applyPendingLayoutPropertyRender() {
      const pendingPatch = this.pendingLayoutPropertyRender;
      if (!pendingPatch) {
        return false;
      }
      this.pendingLayoutPropertyRender = null;

      const container = getContainer.call(this);
      if (!container) {
        return false;
      }

      const action = this.projectFileState.actions.find(
        (actionItem) => actionItem.id === pendingPatch.actionId
      );
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

      const configEntries = editorService.state.get("currentConfig") || {};
      const characterNameMap = new Map(
        Object.entries(configEntries).flatMap(([name, ids]) =>
          ids.map((id) => [id, name])
        )
      );
      const characterName =
        action.characterName || characterNameMap.get(action.characterId);
      const nameElement = layoutCard.querySelector(".speaker-name");
      if (nameElement) {
        nameElement.textContent =
          characterName || `未知角色 (ID: ${action.characterId ?? "?"})`;
      }

      const avatarElement = layoutCard.querySelector(".dialogue-avatar");
      if (avatarElement) {
        configUI.updateConfigAvatar(
          editorService.configManager,
          { querySelector: () => avatarElement },
          action.characterId,
          characterName
        );
        avatarElement.dataset.characterId = String(action.characterId || "");
      }

      this.renderLayoutCardControls(layoutCard, action, characterName, {
        showToggleButton,
      });
      return true;
    },

    // 布局卡片增删：优先局部更新，失败再回退全量渲染。
    applyPendingLayoutMutationRender() {
      const pendingPatch = this.pendingLayoutMutationRender;
      if (
        !pendingPatch ||
        (pendingPatch.type !== "add" && pendingPatch.type !== "delete")
      ) {
        return false;
      }
      this.pendingLayoutMutationRender = null;

      const container = getContainer.call(this);
      const actions = this.projectFileState.actions;
      if (!container) {
        return false;
      }

      const isGroupingEnabled = this.domCache.groupCheckbox.checked;
      const groupSize = this.baseEditor.groupSize;
      const shouldGroup = isGroupingEnabled && actions.length > groupSize;
      const hasGroupHeader = Boolean(
        container.querySelector(".timeline-group-header")
      );

      if (shouldGroup) {
        // 分组模式：刷新组头并仅重建当前展开分组。
        const totalActions = actions.length;
        const totalGroups = Math.ceil(totalActions / groupSize);
        const headers = Array.from(
          container.querySelectorAll(".timeline-group-header")
        );

        let activeGroupIndex = this.activeGroupIndex;
        if (pendingPatch.type === "add") {
          const insertIndex = actions.findIndex(
            (actionItem) => actionItem.id === pendingPatch.actionId
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

        for (let groupIndex = 0; groupIndex < totalGroups; groupIndex++) {
          const header = headers[groupIndex] || document.createElement("div");
          const isActive =
            activeGroupIndex !== null && groupIndex === activeGroupIndex;
          const startNum = groupIndex * groupSize + 1;
          const endNum = Math.min((groupIndex + 1) * groupSize, totalActions);
          const headerText = `${isActive ? "▼" : "▶"} 对话 ${startNum} - ${endNum} (${
            endNum - startNum + 1
          }条)`;
          header.classList.add("timeline-group-header");
          header.dataset.groupIdx = String(groupIndex);
          header.classList.toggle("active", isActive);
          header.textContent = headerText;
          header.onclick = () => {
            const isOpening = this.activeGroupIndex !== groupIndex;
            this.activeGroupIndex = isOpening ? groupIndex : null;
            onGroupToggle.call(this, groupIndex, isOpening);
          };
          fragment.appendChild(header);

          if (isActive) {
            for (
              let actionIndex = startNum - 1;
              actionIndex < endNum;
              actionIndex++
            ) {
              const renderedCard = renderActionCard.call(
                this,
                actions[actionIndex],
                actionIndex
              );
              if (!renderedCard) {
                return false;
              }
              fragment.appendChild(renderedCard);
            }
          }
        }

        container.replaceChildren(fragment);
        return true;
      }

      // 跨阈值(>groupSize -> <=groupSize)时，立即回到非分组卡片列表，确保组头马上消失。
      if (hasGroupHeader) {
        const fragment = document.createDocumentFragment();
        for (let index = 0; index < actions.length; index++) {
          const renderedCard = renderActionCard.call(this, actions[index], index);
          if (!renderedCard) {
            return false;
          }
          fragment.appendChild(renderedCard);
        }
        container.replaceChildren(fragment);
        return true;
      }

      if (pendingPatch.type === "add") {
        const insertIndex = actions.findIndex(
          (actionItem) => actionItem.id === pendingPatch.actionId
        );
        if (insertIndex < 0) {
          return false;
        }
        const insertedAction = actions[insertIndex];
        const newCard = renderActionCard.call(this, insertedAction, insertIndex);
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
        return true;
      }

      // 非分组模式删除：直接删目标卡片并同步后续序号。
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
      return true;
    },
  });
}
