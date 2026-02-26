import { editorService } from "@services/EditorService.js";
import { DragHelper } from "@editors/common/DragHelper.js";
import { createSpeakerRenderers } from "@editors/speaker/speakerRenderers.js";
import {
  getGroupRange,
  updateGroupHeader,
} from "@editors/common/groupHeaderUtils.js";

// 说话人编辑器：对话卡片增删改的局部刷新能力。
export function attachSpeakerCardLocalRefresh(editor) {
  // 同步右侧角色列表：按当前 action 重新统计出现角色。
  const refreshCharacterList = (targetEditor) => {
    const usedIds = targetEditor.getUsedCharacterIds();
    targetEditor.renderCharacterList(usedIds);
  };

  Object.assign(editor, {
    pendingTextEditRender: null,
    pendingSpeakerRender: null,
    pendingCardMutationRender: null,
    lastSpeakerRenderFailReason: "",

    // 说话人变更：标记下次渲染优先局部更新指定卡片。
    markSpeakerRender(actionIds, source = "ui", detail = "") {
      this.pendingSpeakerRender = {
        actionIds,
        source,
        detail,
      };
    },

    // 文本编辑：优先只更新目标卡片文本。
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

    // 说话人变更：优先局部更新目标卡片，失败再回退全量渲染。
    applyPendingSpeakerRender() {
      const pendingPatch = this.pendingSpeakerRender;
      if (!pendingPatch) {
        return false;
      }

      this.pendingSpeakerRender = null;
      const canvas = this.domCache.canvas;
      const actions = this.projectFileState.actions;
      const cardSelector = ".dialogue-item, .layout-item";
      if (!canvas || !actions.length) {
        this.lastSpeakerRenderFailReason = "canvas 或 actions 不可用";
        return false;
      }

      const isGroupingEnabled = this.domCache.groupCheckbox.checked;
      const groupSize = this.baseEditor.groupSize;
      const shouldGroup = isGroupingEnabled && actions.length > groupSize;
      if (shouldGroup) {
        // 分组模式下，如果没有展开任何分组，左侧没有卡片可更新。
        if (this.activeGroupIndex === null) {
          refreshCharacterList(this);
          return true;
        }

        // 目标 action 不在当前展开组时，不需要改左侧卡片，只刷新右侧角色列表即可。
        const groupStart = this.activeGroupIndex * groupSize;
        const groupEnd = Math.min(groupStart + groupSize, actions.length);
        const visibleActionIds = new Set(
          actions.slice(groupStart, groupEnd).map((actionItem) => actionItem.id)
        );
        const hasVisibleTarget = pendingPatch.actionIds.some((actionId) =>
          visibleActionIds.has(actionId)
        );
        if (!hasVisibleTarget) {
          refreshCharacterList(this);
          return true;
        }

        if (!this.applyGroupedMutationRender(actions)) {
          this.lastSpeakerRenderFailReason = "分组局部重绘失败";
          return false;
        }
        refreshCharacterList(this);
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
        const newCard = this.renderActionCard(action, actionIndex);
        if (!newCard) {
          this.lastSpeakerRenderFailReason = `重建卡片失败: ${actionId}, type=${action.type}`;
          return false;
        }

        // 某些交互会先把旧卡片临时移出画布；找不到时按 actionIndex 原位补插。
        const cards = Array.from(canvas.querySelectorAll(cardSelector));
        const targetCard = cards.find(
          (cardElement) => cardElement.dataset.id === actionId,
        );
        if (targetCard) {
          targetCard.replaceWith(newCard);
        } else {
          const referenceNode = cards[actionIndex] || null;
          canvas.insertBefore(newCard, referenceNode);
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
      refreshCharacterList(this);
      this.lastSpeakerRenderFailReason = "";
      return true;
    },

    // 渲染单个 action 卡片（talk/layout），供局部刷新复用。
    renderActionCard(action, globalIndex) {
      const templates =
        this.domCache.templates ||
        (this.domCache.templates = {
          talk: document.getElementById("text-snippet-card-template"),
          layout: document.getElementById("timeline-layout-card-template"),
        });
      const configEntries = editorService.state.get("currentConfig") || {};
      const characterNameMap = new Map(
        Object.entries(configEntries).flatMap(([name, ids]) =>
          ids.map((id) => [id, name]),
        ),
      );
      const { renderSingleCard } = createSpeakerRenderers(this, {
        templates,
        characterNameMap,
      });
      return renderSingleCard(action, globalIndex);
    },

    // 分组模式下：只重绘当前展开分组的卡片，并同步组头文案。
    applyGroupedMutationRender(actions) {
      const canvas = this.domCache.canvas;
      const preservedScrollTop = canvas?.scrollTop ?? 0;
      const groupSize = this.baseEditor.groupSize;
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
        const { startNum, endNum } = getGroupRange(
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
        const renderedCard = this.renderActionCard(actions[index], index);
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

    // 新增/删除卡片时：优先局部更新左侧列表，失败再回退全量渲染。
    applyPendingCardMutationRender() {
      const pendingPatch = this.pendingCardMutationRender;
      if (!pendingPatch) {
        return false;
      }

      this.pendingCardMutationRender = null;
      const canvas = this.domCache.canvas;
      const actions = this.projectFileState.actions;
      const cardSelector = ".dialogue-item, .layout-item";
      if (!canvas || !actions.length) {
        return false;
      }

      const isGroupingEnabled = this.domCache.groupCheckbox.checked;
      const groupSize = this.baseEditor.groupSize;
      const shouldGroup = isGroupingEnabled && actions.length > groupSize;
      const hasGroupHeader = Boolean(
        canvas.querySelector(".timeline-group-header"),
      );

      if (shouldGroup) {
        // 跨阈值(<=50 -> >50)时，先切到目标分组并走标准分组渲染，避免回退全量。
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
          const usedIds = this.renderCanvas();
          this.renderCharacterList(usedIds);
          return true;
        }

        if (!this.applyGroupedMutationRender(actions)) {
          return false;
        }
        refreshCharacterList(this);
        return true;
      }

      // 跨阈值(>50 -> <=50)时，立即回到非分组渲染，确保组头立刻消失。
      if (hasGroupHeader) {
        const usedIds = this.renderCanvas();
        this.renderCharacterList(usedIds);
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

        const newCard = this.renderActionCard(insertedAction, insertIndex);
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
        refreshCharacterList(this);
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
        refreshCharacterList(this);
        return true;
      }

      return false;
    },
  });
}
