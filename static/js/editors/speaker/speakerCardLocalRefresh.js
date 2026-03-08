// 处理说话人编辑器的局部刷新
import { DragHelper } from "@editors/common/DragHelper.js";
import {
  resolveGroupRange,
  updateGroupHeader,
} from "@editors/common/groupHeaderUtils.js";

// 渲染一张说话人编辑器卡片
export function renderSpeakerActionCard(editor, action, globalIndex) {
  const { renderSingleCard } = editor.buildSpeakerRendererSet();
  return renderSingleCard(action, globalIndex);
}

// 添加卡片局部刷新
export function attachSpeakerCardLocalRefresh(editor) {
  const cardSelector = ".dialogue-item, .layout-item";

  Object.assign(editor, {
    pendingTextEditRender: null,
    pendingSpeakerRender: null,
    pendingCardMutationRender: null,
    lastSpeakerRenderFailReason: "",

    // 标记要刷新的说话人卡片
    markSpeakerRender(actionIds, source = "ui", detail = "") {
      this.pendingSpeakerRender = {
        actionIds,
        source,
        detail,
      };
    },

    // 只改卡片文本
    applyPendingTextEditRender() {
      const pendingPatch = this.pendingTextEditRender;
      if (!pendingPatch) {
        return false;
      }

      this.pendingTextEditRender = null;
      const canvas = this.domCache.canvas;
      if (!canvas) {
        return false;
      }

      const targetCard = canvas.querySelector(
        `.dialogue-item[data-id="${pendingPatch.actionId}"]`,
      );
      if (!targetCard) {
        return false;
      }
      const textElement = targetCard.querySelector(".dialogue-text");
      if (!textElement) {
        return false;
      }

      textElement.textContent = pendingPatch.text;
      return true;
    },

    // 尝试局部刷新说话人卡片
    applyPendingSpeakerRender() {
      const pendingPatch = this.pendingSpeakerRender;
      if (!pendingPatch) {
        return false;
      }

      this.pendingSpeakerRender = null;
      const canvas = this.domCache.canvas;
      const actions = this.projectFileState.actions;
      if (!canvas || !actions.length) {
        this.lastSpeakerRenderFailReason = "canvas 或 actions 不可用";
        return false;
      }

      const isGroupingEnabled = this.domCache.groupCheckbox.checked;
      const groupSize = this.groupSize;
      const shouldGroup = isGroupingEnabled && actions.length > groupSize;
      if (shouldGroup) {
        // 分组没展开时只刷右侧列表
        if (this.activeGroupIndex === null) {
          this.renderCharacterListForCurrentProject();
          return true;
        }

        // 目标不在当前组时只刷右侧列表
        const groupStart = this.activeGroupIndex * groupSize;
        const groupEnd = Math.min(groupStart + groupSize, actions.length);
        const visibleActionIds = new Set(
          actions.slice(groupStart, groupEnd).map((actionItem) => actionItem.id)
        );
        const hasVisibleTarget = pendingPatch.actionIds.some((actionId) =>
          visibleActionIds.has(actionId)
        );
        if (!hasVisibleTarget) {
          this.renderCharacterListForCurrentProject();
          return true;
        }

        if (!this.applyGroupedMutationRender(actions)) {
          this.lastSpeakerRenderFailReason = "分组局部重绘失败";
          return false;
        }
        this.renderCharacterListForCurrentProject();
        this.lastSpeakerRenderFailReason = "";
        return true;
      }

      let startIndex = actions.length;
      for (const actionId of pendingPatch.actionIds) {
        const actionIndex = actions.findIndex(
          (actionItem) => actionItem.id === actionId,
        );
        if (actionIndex < 0) {
          this.lastSpeakerRenderFailReason = `未找到 action: ${actionId}`;
          return false;
        }

        const action = actions[actionIndex];
        const newCard = renderSpeakerActionCard(this, action, actionIndex);
        if (!newCard) {
          this.lastSpeakerRenderFailReason = `重建卡片失败: ${actionId}, type=${action.type}`;
          return false;
        }

        // 找不到旧卡片时按顺序补回去
        const cards = Array.from(canvas.querySelectorAll(cardSelector));
        const targetCard = cards.find(
          (cardElement) => cardElement.dataset.id === actionId,
        );
        if (targetCard) {
          targetCard.replaceWith(newCard);
        } else {
          // 先插入 再按 state 顺序重排
          canvas.appendChild(newCard);
          const allCards = Array.from(canvas.querySelectorAll(cardSelector));
          const cardById = new Map(
            allCards.map((cardElement) => [
              cardElement.dataset.id,
              cardElement,
            ]),
          );
          for (const stateAction of actions) {
            const card = cardById.get(stateAction.id);
            if (card) {
              canvas.appendChild(card);
            }
          }
        }

        if (actionIndex < startIndex) {
          startIndex = actionIndex;
        }
      }

      DragHelper.syncCardOrderMeta({
        container: canvas,
        cardSelector,
        startIndex,
        baseIndex: 0,
      });
      this.renderCharacterListForCurrentProject();
      this.lastSpeakerRenderFailReason = "";
      return true;
    },

    // 分组模式下重新渲染当前组
    applyGroupedMutationRender(actions) {
      const canvas = this.domCache.canvas;
      const preservedScrollTop = canvas?.scrollTop ?? 0;
      const groupSize = this.groupSize;
      const activeGroupIndex = this.activeGroupIndex;
      const totalActions = actions.length;
      const totalGroups = Math.ceil(totalActions / groupSize);
      if (
        !canvas ||
        activeGroupIndex === null ||
        activeGroupIndex < 0 ||
        activeGroupIndex >= totalGroups
      ) {
        return false;
      }

      const headers = canvas.querySelectorAll(".timeline-group-header");
      if (headers.length !== totalGroups) {
        return false;
      }

      headers.forEach((header, groupIndex) => {
        const { startNum, endNum } = resolveGroupRange(
          groupIndex,
          groupSize,
          totalActions
        );
        const isActive = groupIndex === activeGroupIndex;
        updateGroupHeader(header, {
          groupIndex,
          isActive,
          startNum,
          endNum,
        });
      });

      const activeHeader = canvas.querySelector(
        `.timeline-group-header[data-group-idx="${activeGroupIndex}"]`,
      );
      if (!activeHeader) {
        return false;
      }

      const start = activeGroupIndex * groupSize;
      const end = Math.min(start + groupSize, totalActions);
      const fragment = document.createDocumentFragment();
      for (let index = start; index < end; index++) {
        const renderedCard = renderSpeakerActionCard(this, actions[index], index);
        if (!renderedCard) {
          return false;
        }
        fragment.appendChild(renderedCard);
      }

      const removableCards = [];
      let nextNode = activeHeader.nextElementSibling;
      while (
        nextNode &&
        !nextNode.classList.contains("timeline-group-header")
      ) {
        removableCards.push(nextNode);
        nextNode = nextNode.nextElementSibling;
      }
      removableCards.forEach((cardElement) => cardElement.remove());
      canvas.insertBefore(fragment, nextNode);
      canvas.scrollTop = preservedScrollTop;

      return true;
    },

    // 尝试局部处理卡片增删
    applyPendingCardMutationRender() {
      const pendingPatch = this.pendingCardMutationRender;
      if (!pendingPatch) {
        return false;
      }

      this.pendingCardMutationRender = null;
      const canvas = this.domCache.canvas;
      const actions = this.projectFileState.actions;
      if (!canvas || !actions.length) {
        return false;
      }

      const isGroupingEnabled = this.domCache.groupCheckbox.checked;
      const groupSize = this.groupSize;
      const shouldGroup = isGroupingEnabled && actions.length > groupSize;
      const hasGroupHeader = Boolean(
        canvas.querySelector(".timeline-group-header"),
      );

      if (shouldGroup) {
        // 跨分组阈值时切到目标组
        if (!hasGroupHeader) {
          if (pendingPatch.type === "add") {
            const insertIndex = actions.findIndex(
              (actionItem) => actionItem.id === pendingPatch.actionId,
            );
            this.activeGroupIndex =
              insertIndex >= 0 ? Math.floor(insertIndex / groupSize) : 0;
          } else if (this.activeGroupIndex === null) {
            this.activeGroupIndex = 0;
          }
          this.renderPrimaryViewWithCharacters(() => this.renderCanvas());
          return true;
        }

        if (!this.applyGroupedMutationRender(actions)) {
          return false;
        }
        this.renderCharacterListForCurrentProject();
        return true;
      }

      // 从分组退回普通模式时立即刷新
      if (hasGroupHeader) {
        this.renderPrimaryViewWithCharacters(() => this.renderCanvas());
        return true;
      }

      if (pendingPatch.type === "add") {
        const insertIndex = actions.findIndex(
          (actionItem) => actionItem.id === pendingPatch.actionId,
        );
        const insertedAction = insertIndex >= 0 ? actions[insertIndex] : null;
        if (!insertedAction) {
          return false;
        }

        const newCard = renderSpeakerActionCard(this, insertedAction, insertIndex);
        if (!newCard) {
          return false;
        }

        const cards = canvas.querySelectorAll(cardSelector);
        const referenceNode = cards[insertIndex] || null;
        canvas.insertBefore(newCard, referenceNode);
        DragHelper.syncCardOrderMeta({
          container: canvas,
          cardSelector,
          startIndex: insertIndex,
          baseIndex: 0,
        });
        this.renderCharacterListForCurrentProject();
        return true;
      }

      if (pendingPatch.type === "delete") {
        const cards = Array.from(canvas.querySelectorAll(cardSelector));
        const targetCard = cards.find(
          (cardElement) => cardElement.dataset.id === pendingPatch.actionId,
        );
        if (!targetCard) {
          return false;
        }

        targetCard.remove();
        DragHelper.syncCardOrderMeta({
          container: canvas,
          cardSelector,
          startIndex: pendingPatch.startIndex,
          baseIndex: 0,
        });
        this.renderCharacterListForCurrentProject();
        return true;
      }

      return false;
    },
  });
}
