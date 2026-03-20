// 处理说话人编辑器的局部刷新
import { DragHelper } from "@editors/common/DragHelper.js";
import { resolveGroupRange, updateGroupHeader } from "@editors/common/groupHeaderUtils.js";

// 渲染一张说话人编辑器卡片
export function renderSpeakerCard(editor, action, globalIndex) {
  const { renderSingleCard } = editor.buildRendererSet();
  return renderSingleCard(action, globalIndex);
}

// 添加卡片局部刷新
export function attachSpeakerRefresh(editor) {
  const cardSelector = ".dialogue-item, .layout-item";

  Object.assign(editor, {
    pendingTextChange: null,
    pendingSpeakerChange: null,
    pendingCardMutation: null,
    lastSpeakerError: "",

    // 标记要刷新的说话人卡片
    markSpeakerChange(actionIds, source = "ui", detail = "") {
      this.pendingSpeakerChange = {
        actionIds,
        source,
        detail,
      };
    },

    // 只改卡片文本
    applyTextChange() {
      const pendingPatch = this.pendingTextChange;
      if (!pendingPatch) {
        return false;
      }

      this.pendingTextChange = null;
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
    applySpeakerChange() {
      const pendingPatch = this.pendingSpeakerChange;
      if (!pendingPatch) {
        return false;
      }

      this.pendingSpeakerChange = null;
      const canvas = this.domCache.canvas;
      const actions = this.projectFileState.actions;
      if (!canvas || !actions.length) {
        this.lastSpeakerError = "canvas 或 actions 不可用";
        return false;
      }

      const isGroupingEnabled = this.domCache.groupCheckbox.checked;
      const groupSize = this.groupSize;
      const shouldGroup = isGroupingEnabled && actions.length > groupSize;
      if (shouldGroup) {
        // 分组时先判断这次修改有没有打到当前展开组
        // 分组没展开时只刷右侧列表
        if (this.activeGroupIndex === null) {
          this.renderUsedList();
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
          this.renderUsedList();
          return true;
        }

        const visibleTargetIds = pendingPatch.actionIds.filter((actionId) =>
          visibleActionIds.has(actionId)
        );
        let shouldFallbackToGroupRefresh = false;
        for (const actionId of visibleTargetIds) {
          const actionIndex = actions.findIndex(
            (actionItem) => actionItem.id === actionId,
          );
          if (actionIndex < 0) {
            this.lastSpeakerError = `未找到 action: ${actionId}`;
            return false;
          }

          const action = actions[actionIndex];
          const targetCard = canvas.querySelector(
            `.dialogue-item[data-id="${actionId}"], .layout-item[data-id="${actionId}"]`,
          );
          if (!targetCard) {
            shouldFallbackToGroupRefresh = true;
            break;
          }

          const newCard = renderSpeakerCard(this, action, actionIndex);
          if (!newCard) {
            this.lastSpeakerError = `重建卡片失败: ${actionId}, type=${action.type}`;
            return false;
          }

          targetCard.replaceWith(newCard);
        }

        if (shouldFallbackToGroupRefresh && !this.applyGroupMutation(actions)) {
          this.lastSpeakerError = "分组局部重绘失败";
          return false;
        }
        this.renderUsedList();
        this.lastSpeakerError = "";
        return true;
      }

      // 非分组模式只重建命中的卡片 再补序号
      let startIndex = actions.length;
      for (const actionId of pendingPatch.actionIds) {
        const actionIndex = actions.findIndex(
          (actionItem) => actionItem.id === actionId,
        );
        if (actionIndex < 0) {
          this.lastSpeakerError = `未找到 action: ${actionId}`;
          return false;
        }

        const action = actions[actionIndex];
        const newCard = renderSpeakerCard(this, action, actionIndex);
        if (!newCard) {
          this.lastSpeakerError = `重建卡片失败: ${actionId}, type=${action.type}`;
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
      this.renderUsedList();
      this.lastSpeakerError = "";
      return true;
    },

    // 分组模式下重新渲染当前组
    applyGroupMutation(actions) {
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

      // 先重算所有组头 再只重画当前展开组
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
        const renderedCard = renderSpeakerCard(this, actions[index], index);
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
    applyCardMutation() {
      const pendingPatch = this.pendingCardMutation;
      if (!pendingPatch) {
        return false;
      }

      this.pendingCardMutation = null;
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
        // 卡片数量跨过分组阈值时 直接切回整组渲染
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
          this.renderViewAndList(() => this.renderCanvas());
          return true;
        }

        if (!this.applyGroupMutation(actions)) {
          return false;
        }
        this.renderUsedList();
        return true;
      }

      // 从分组退回普通模式时立即刷新
      if (hasGroupHeader) {
        this.renderViewAndList(() => this.renderCanvas());
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

        const newCard = renderSpeakerCard(this, insertedAction, insertIndex);
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
        this.renderUsedList();
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
        this.renderUsedList();
        return true;
      }

      return false;
    },
  });
}
