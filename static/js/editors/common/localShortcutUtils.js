// 局部刷新日志的小工具
import { shortValue, summarizeChanges } from "@editors/common/changeSummaryUtils.js";

// 按顺序试每一种局部刷新
export function runShortcutSteps(steps, onFallback) {
  const failedReasons = [];
  for (const step of steps) {
    if (!step.pending) {
      continue;
    }
    if (step.apply()) {
      step.onHit();
      return true;
    }
    failedReasons.push(step.failReason());
  }
  if (failedReasons.length) {
    onFallback(failedReasons);
  }
  return false;
}

// 拼布局属性日志
export function buildLayoutLogParts(pendingLayout, maxLength = 84) {
  const detail = pendingLayout.detail || {};
  const logParts = [`action=${pendingLayout.actionId || "unknown"}`];
  if (detail.source) {
    logParts.push(`source=${detail.source}`);
  }
  if (detail.field) {
    logParts.push(`field=${detail.field}`);
  }
  const hasValueDiff =
    typeof detail === "object" &&
    ("beforeValue" in detail || "afterValue" in detail);
  if (hasValueDiff) {
    logParts.push(
      `${shortValue(detail.beforeValue, maxLength)} -> ${shortValue(
        detail.afterValue,
        maxLength
      )}`
    );
  }
  if (detail.changes) {
    logParts.push(`changes=${summarizeChanges(detail.changes, maxLength)}`);
  }
  return logParts;
}

// 拼带来源的日志片段
export function buildSourceDetailLogParts(baseParts, pendingItem, detail) {
  const logParts = [...baseParts];
  if (pendingItem.source) logParts.push(`source=${pendingItem.source}`);
  if (detail) logParts.push(detail);
  return logParts;
}

// 拼说话人变化日志
export function buildSpeakerLogParts(pendingSpeaker) {
  return buildSourceDetailLogParts(
    [`actions=${pendingSpeaker.actionIds.join("|")}`],
    pendingSpeaker,
    pendingSpeaker.detail,
  );
}

// 拼文本变化日志
export function buildTextUpdateLogParts(pendingText, maxLength = 84) {
  return buildSourceDetailLogParts(
    [`action=${pendingText.actionId || "unknown"}`],
    pendingText,
    pendingText.detail ||
      `text: "${shortValue(pendingText.oldText, maxLength)}" -> "${shortValue(
        pendingText.text,
        maxLength,
      )}"`,
  );
}

// 拼卡片增删日志
export function buildMutationLogParts(pendingMutation) {
  const logParts = [`type=${pendingMutation.type || "unknown"}`, `action=${pendingMutation.actionId || "unknown"}`];
  if (pendingMutation.source) logParts.push(`source=${pendingMutation.source}`);
  if (pendingMutation.detail) logParts.push(`详情=${pendingMutation.detail}`);
  return logParts;
}

// 生成布局编辑器要用的撤销重做标记
export function createLayoutUndoRedoHandlers(editor) {
  return {
    onActionAdded: ({ actionAfter, summary, phase }) => {
      if (actionAfter?.type === "layout") {
        editor.markLayoutMutationRender(actionAfter.id, "add", {
          source: phase,
          detail: summary,
        });
      }
    },
    onActionRemoved: ({ actionBefore, summary, phase }) => {
      if (actionBefore?.type === "layout") {
        editor.markLayoutMutationRender(actionBefore.id, "delete", {
          source: phase,
          detail: summary,
        });
      }
    },
    onActionOrderChanged: ({ phase, orderSummary }) => {
      editor.markGroupedReorderRender("state", phase, orderSummary);
    },
    onLayoutFieldChanged: ({ actionId, actionAfter, changes, phase }) => {
      if (actionAfter?.type === "layout") {
        editor.markLayoutPropertyRender(actionId, { source: phase, changes });
      }
    },
  };
}

// 生成对话编辑器要用的撤销重做标记
export function createSpeakerUndoRedoHandlers(editor, maxLength = 84) {
  return {
    onActionAdded: ({ actionAfter, summary, phase }) => {
      editor.pendingCardMutationRender = {
        type: "add",
        actionId: actionAfter.id,
        source: phase,
        detail: summary,
      };
    },
    onActionRemoved: ({ actionBefore, indexBefore, summary, phase }) => {
      editor.pendingCardMutationRender = {
        type: "delete",
        actionId: actionBefore.id,
        startIndex: indexBefore,
        source: phase,
        detail: summary,
      };
    },
    onActionOrderChanged: ({ phase, orderSummary }) => {
      editor.markGroupedReorderRender("state", phase, orderSummary);
    },
    onTextChanged: ({ actionId, actionBefore, actionAfter, changes, phase }) => {
      editor.pendingTextEditRender = {
        actionId,
        text: actionAfter?.text || "",
        oldText: actionBefore?.text || "",
        source: phase,
        detail: summarizeChanges(changes, maxLength),
      };
    },
    onSpeakerFieldChanged: ({ actionId, actionIds, changes, phase }) => {
      editor.markSpeakerRender(
        Array.isArray(actionIds) && actionIds.length > 0 ? actionIds : [actionId],
        phase,
        `changes=${summarizeChanges(changes, maxLength) || "none"}`
      );
    },
    onLayoutFieldChanged: ({ actionId, changes, phase }) => {
      editor.markLayoutPropertyRender(actionId, { source: phase, changes });
    },
  };
}
