import { editorService } from "@services/EditorService.js";
import { DragHelper } from "@editors/common/DragHelper.js";
import { createLive2DRenderers } from "@editors/live2d/live2dTimelineRenderers.js";
import {
  getGroupRange,
  updateGroupHeader,
} from "@editors/common/groupHeaderUtils.js";

// Live2D 编辑器：布局卡片增删后的局部短路刷新（不改后续模式判定逻辑）。
export function attachLive2DLayoutMutationLocalRefresh(editor) {
  // 统一解析布局增删标记的日志信息。
  const parseMutationDetail = (detail) => {
    if (!detail) {
      return { source: null, text: "" };
    }
    if (typeof detail === "string") {
      return { source: null, text: detail };
    }
    return {
      source: detail.source || null,
      text: detail.detail || "",
    };
  };
  Object.assign(editor, {
    pendingLayoutMutationRender: null,

    // 标记“下次渲染优先局部处理布局卡片增删变更”。
    markLayoutMutationRender(actionId, type = "add", detail = null) {
      const parsedDetail = parseMutationDetail(detail);
      this.pendingLayoutMutationRender = {
        type,
        actionId,
        source: parsedDetail.source,
        detail: parsedDetail.text,
      };
    },

    // 渲染单条 action 卡片（talk/layout），用于局部插入。
    renderTimelineActionCard(action, globalIndex) {
      const templates =
        this.domCache.templates ||
        (this.domCache.templates = {
          talk: document.getElementById("timeline-talk-card-template"),
          layout: document.getElementById("timeline-layout-card-template"),
        });
      const configEntries = editorService.state.get("currentConfig") || {};
      const characterNameMap = new Map(
        Object.entries(configEntries).flatMap(([name, ids]) =>
          ids.map((id) => [id, name]),
        ),
      );
      const { renderSingleCard } = createLive2DRenderers(this, {
        templates,
        characterNameMap,
      });
      return renderSingleCard(action, globalIndex);
    },

    // 分组模式下：重建分组头与当前展开分组内容，完成增删后的局部刷新。
    applyGroupedLayoutMutationRender(actions) {
      const timeline = this.domCache.timeline;
      const preservedScrollTop = timeline?.scrollTop ?? 0;
      const groupSize = this.baseEditor.groupSize;
      if (!timeline || !actions.length) {
        return false;
      }

      const totalActions = actions.length;
      const totalGroups = Math.ceil(totalActions / groupSize);
      let activeGroupIndex = this.activeGroupIndex;
      if (activeGroupIndex === null && totalGroups > 0) {
        activeGroupIndex = 0;
        this.activeGroupIndex = 0;
      }
      if (
        activeGroupIndex !== null &&
        activeGroupIndex >= totalGroups &&
        totalGroups > 0
      ) {
        activeGroupIndex = totalGroups - 1;
        this.activeGroupIndex = activeGroupIndex;
      }
      const headers = Array.from(
        timeline.querySelectorAll(".timeline-group-header"),
      );
      if (!headers.length) {
        this.renderTimeline();
        return true;
      }

      const fragment = document.createDocumentFragment();

      for (let groupIndex = 0; groupIndex < totalGroups; groupIndex++) {
        const header = headers[groupIndex] || headers[0].cloneNode(true);
        const isActive =
          activeGroupIndex !== null && groupIndex === activeGroupIndex;
        const { startNum, endNum } = getGroupRange(
          groupIndex,
          groupSize,
          totalActions
        );
        updateGroupHeader(header, {
          groupIndex,
          isActive,
          startNum,
          endNum,
          onToggle: (index) => {
            const isOpening = this.activeGroupIndex !== index;
            this.activeGroupIndex = isOpening ? index : null;
            const targetGroupIndex = index;
          this.renderTimeline();
          if (isOpening) {
            setTimeout(() => {
              const headerElement = this.domCache.timeline.querySelector(
                `.timeline-group-header[data-group-idx="${targetGroupIndex}"]`,
              );
              if (this.domCache.timeline && headerElement) {
                this.domCache.timeline.scrollTo({
                  top: headerElement.offsetTop - 110,
                  behavior: "smooth",
                });
              }
            }, 0);
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
            const card = this.renderTimelineActionCard(
              actions[actionIndex],
              actionIndex,
            );
            if (!card) {
              return false;
            }
            fragment.appendChild(card);
          }
        }
      }

      timeline.replaceChildren(fragment);
      timeline.scrollTop = preservedScrollTop;
      return true;
    },

    // 布局卡片增删时：优先局部更新，失败则回退全量渲染。
    applyPendingLayoutMutationRender() {
      const pendingPatch = this.pendingLayoutMutationRender;
      if (
        !pendingPatch ||
        (pendingPatch.type !== "add" && pendingPatch.type !== "delete")
      ) {
        return false;
      }
      this.pendingLayoutMutationRender = null;

      const timeline = this.domCache.timeline;
      const actions = this.projectFileState.actions;
      if (!timeline || !actions.length) {
        return false;
      }

      const isGroupingEnabled = this.domCache.groupCheckbox.checked;
      const groupSize = this.baseEditor.groupSize;
      if (isGroupingEnabled && actions.length > groupSize) {
        if (!this.applyGroupedLayoutMutationRender(actions)) {
          return false;
        }
        const usedNames = this.getUsedCharacterIds();
        this.renderCharacterList(usedNames);
        return true;
      }

      if (timeline.querySelector(".timeline-group-header")) {
        this.renderTimeline();
        const usedNames = this.getUsedCharacterIds();
        this.renderCharacterList(usedNames);
        return true;
      }

      if (pendingPatch.type === "delete") {
        const cardSelector = ".talk-item, .layout-item";
        const cards = Array.from(timeline.querySelectorAll(cardSelector));
        const targetIndex = cards.findIndex(
          (cardElement) => cardElement.dataset.id === pendingPatch.actionId,
        );
        if (targetIndex < 0) {
          return false;
        }

        cards[targetIndex].remove();
        DragHelper.syncCardOrderMeta({
          container: timeline,
          cardSelector,
          startIndex: targetIndex,
          baseIndex: 0,
        });

        const usedNames = this.getUsedCharacterIds();
        this.renderCharacterList(usedNames);
        return true;
      }

      const insertIndex = actions.findIndex(
        (actionItem) => actionItem.id === pendingPatch.actionId,
      );
      const insertedAction = insertIndex >= 0 ? actions[insertIndex] : null;
      if (!insertedAction) {
        return false;
      }

      const newCard = this.renderTimelineActionCard(
        insertedAction,
        insertIndex,
      );
      if (!newCard) {
        return false;
      }

      const cardSelector = ".talk-item, .layout-item";
      const cards = timeline.querySelectorAll(cardSelector);
      const referenceNode = cards[insertIndex] || null;
      timeline.insertBefore(newCard, referenceNode);
      DragHelper.syncCardOrderMeta({
        container: timeline,
        cardSelector,
        startIndex: insertIndex,
        baseIndex: 0,
      });

      const usedNames = this.getUsedCharacterIds();
      this.renderCharacterList(usedNames);
      return true;
    },
  });
}
