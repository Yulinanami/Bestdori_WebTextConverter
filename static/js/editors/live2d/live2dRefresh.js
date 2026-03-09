// 处理 Live2D 卡片增删后的局部刷新
import { state } from "@managers/stateManager.js";
import { DragHelper } from "@editors/common/DragHelper.js";
import { buildCards } from "@editors/live2d/live2dCards.js";
import { resolveGroupRange, scrollToGroupHeader, updateGroupHeader } from "@editors/common/groupHeaderUtils.js";
import { buildNameMap } from "@utils/TimelineCardFactory.js";

// 添加布局卡片局部刷新
export function attachLive2DRefresh(editor) {
  // 解析增删日志信息
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
    pendingLayoutPatch: null,

    // 标记要刷新的增删操作
    markLayoutMutation(actionId, type = "add", detail = null) {
      const parsedDetail = parseMutationDetail(detail);
      this.pendingLayoutPatch = {
        type,
        actionId,
        source: parsedDetail.source,
        detail: parsedDetail.text,
      };
    },

    // 渲染一张时间线卡片
    renderTimelineCard(action, globalIndex) {
      const templates =
        this.domCache.templates ||
        (this.domCache.templates = {
          talk: document.getElementById("timeline-talk-card-template"),
          layout: document.getElementById("timeline-layout-card-template"),
        });
      const configEntries = state.currentConfig || {};
      const characterNameMap = buildNameMap(configEntries);
      const { renderSingleCard } = buildCards(this, {
        templates,
        characterNameMap,
      });
      return renderSingleCard(action, globalIndex);
    },

    // 分组模式下重新渲染当前组
    applyGroupMutation(actions) {
      const timeline = this.domCache.timeline;
      const preservedScrollTop = timeline?.scrollTop ?? 0;
      const groupSize = this.groupSize;
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

      // 先把所有组头重建出来 只给当前展开组挂卡片
      for (let groupIndex = 0; groupIndex < totalGroups; groupIndex++) {
        const header = headers[groupIndex]
          ? headers[groupIndex].cloneNode(true)
          : headers[0].cloneNode(true);
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
          // 切换分组时同步展开状态再重画时间线
          onToggle: (index) => {
            const isOpening = this.activeGroupIndex !== index;
            this.activeGroupIndex = isOpening ? index : null;
            this.renderTimeline();
            if (isOpening) {
              setTimeout(
                () => scrollToGroupHeader(this.domCache.timeline, index),
                0,
              );
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
            const card = this.renderTimelineCard(
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

    // 尝试局部处理卡片增删
    applyLayoutMutation() {
      const pendingPatch = this.pendingLayoutPatch;
      if (
        !pendingPatch ||
        (pendingPatch.type !== "add" && pendingPatch.type !== "delete")
      ) {
        return false;
      }
      this.pendingLayoutPatch = null;

      const timeline = this.domCache.timeline;
      const actions = this.projectFileState.actions;
      if (!timeline || !actions.length) {
        return false;
      }

      const isGroupingEnabled = this.domCache.groupCheckbox.checked;
      const groupSize = this.groupSize;
      if (isGroupingEnabled && actions.length > groupSize) {
        if (!this.applyGroupMutation(actions)) {
          return false;
        }
        this.renderUsedList();
        return true;
      }

      if (timeline.querySelector(".timeline-group-header")) {
        this.renderTimeline();
        this.renderUsedList();
        return true;
      }

      // 非分组模式下再按增删类型只改命中的卡片
      if (pendingPatch.type === "delete") {
        const cards = Array.from(timeline.querySelectorAll(".talk-item, .layout-item"));
        const targetIndex = cards.findIndex(
          (cardElement) => cardElement.dataset.id === pendingPatch.actionId,
        );
        if (targetIndex < 0) {
          return false;
        }

        cards[targetIndex].remove();
        DragHelper.syncCardOrderMeta({
          container: timeline,
          cardSelector: ".talk-item, .layout-item",
          startIndex: targetIndex,
          baseIndex: 0,
        });

        this.renderUsedList();
        return true;
      }

      const insertIndex = actions.findIndex(
        (actionItem) => actionItem.id === pendingPatch.actionId,
      );
      const insertedAction = insertIndex >= 0 ? actions[insertIndex] : null;
      if (!insertedAction) {
        return false;
      }

      const newCard = this.renderTimelineCard(
        insertedAction,
        insertIndex,
      );
      if (!newCard) {
        return false;
      }

      const cards = timeline.querySelectorAll(".talk-item, .layout-item");
      const referenceNode = cards[insertIndex] || null;
      timeline.insertBefore(newCard, referenceNode);
      DragHelper.syncCardOrderMeta({
        container: timeline,
        cardSelector: ".talk-item, .layout-item",
        startIndex: insertIndex,
        baseIndex: 0,
      });

      this.renderUsedList();
      return true;
    },
  });
}
