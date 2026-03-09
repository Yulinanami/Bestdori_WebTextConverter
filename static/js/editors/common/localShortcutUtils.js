// 局部刷新日志的小工具
import { shortValue, summarizeChanges } from "@editors/common/changeSummaryUtils.js";

// 按顺序试每一种局部刷新
export function runShortcutSteps(steps, onFallback) {
  const failedReasons = [];
  // 只要命中一条局部短路就直接停
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
export function layoutLog(pendingLayout, maxLength = 84) {
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
export function buildDetailLogParts(baseParts, pendingItem, detail) {
  const logParts = [...baseParts];
  if (pendingItem.source) logParts.push(`source=${pendingItem.source}`);
  if (detail) logParts.push(detail);
  return logParts;
}

// 拼说话人变化日志
export function speakerLog(pendingSpeaker) {
  return buildDetailLogParts(
    [`actions=${pendingSpeaker.actionIds.join("|")}`],
    pendingSpeaker,
    pendingSpeaker.detail,
  );
}

// 拼文本变化日志
export function textLog(pendingText, maxLength = 84) {
  return buildDetailLogParts(
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
export function mutationLog(pendingMutation) {
  const logParts = [`type=${pendingMutation.type || "unknown"}`, `action=${pendingMutation.actionId || "unknown"}`];
  if (pendingMutation.source) logParts.push(`source=${pendingMutation.source}`);
  if (pendingMutation.detail) logParts.push(`详情=${pendingMutation.detail}`);
  return logParts;
}

// 生成布局编辑器要用的撤销重做标记
export function buildLayoutUndoHooks(editor) {
  // 把撤销重做里的结构变化映射成布局局部刷新标记
  return {
    // 标记新增的布局卡片
    onActionAdded: ({ actionAfter, summary, phase }) => {
      if (actionAfter?.type === "layout") {
        editor.markLayoutMutation(actionAfter.id, "add", {
          source: phase,
          detail: summary,
        });
      }
    },
    // 标记删除的布局卡片
    onActionRemoved: ({ actionBefore, summary, phase }) => {
      if (actionBefore?.type === "layout") {
        editor.markLayoutMutation(actionBefore.id, "delete", {
          source: phase,
          detail: summary,
        });
      }
    },
    // 标记布局排序变化
    onActionOrderChanged: ({ phase, orderSummary }) => {
      editor.markGroupReorder("state", phase, orderSummary);
    },
    // 标记布局字段变化
    onLayoutFieldChanged: ({ actionId, actionAfter, changes, phase }) => {
      if (actionAfter?.type === "layout") {
        editor.markLayoutChange(actionId, { source: phase, changes });
      }
    },
  };
}

// 生成对话编辑器要用的撤销重做标记
export function speakerUndoHooks(editor, maxLength = 84) {
  // 把撤销重做里的不同变化映射成对话局部刷新标记
  return {
    // 标记新增的对话卡片
    onActionAdded: ({ actionAfter, summary, phase }) => {
      editor.pendingCardMutation = {
        type: "add",
        actionId: actionAfter.id,
        source: phase,
        detail: summary,
      };
    },
    // 标记删除的对话卡片
    onActionRemoved: ({ actionBefore, indexBefore, summary, phase }) => {
      editor.pendingCardMutation = {
        type: "delete",
        actionId: actionBefore.id,
        startIndex: indexBefore,
        source: phase,
        detail: summary,
      };
    },
    // 标记对话排序变化
    onActionOrderChanged: ({ phase, orderSummary }) => {
      editor.markGroupReorder("state", phase, orderSummary);
    },
    // 标记文本变化
    onTextChanged: ({ actionId, actionBefore, actionAfter, changes, phase }) => {
      editor.pendingTextChange = {
        actionId,
        text: actionAfter?.text || "",
        oldText: actionBefore?.text || "",
        source: phase,
        detail: summarizeChanges(changes, maxLength),
      };
    },
    // 标记说话人变化
    onSpeakerChange: ({ actionId, actionIds, changes, phase }) => {
      editor.markSpeakerChange(
        Array.isArray(actionIds) && actionIds.length > 0 ? actionIds : [actionId],
        phase,
        `changes=${summarizeChanges(changes, maxLength) || "none"}`
      );
    },
    // 标记布局字段变化
    onLayoutFieldChanged: ({ actionId, changes, phase }) => {
      editor.markLayoutChange(actionId, { source: phase, changes });
    },
  };
}
