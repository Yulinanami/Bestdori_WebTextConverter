import { shortValue, summarizeChanges } from "@editors/common/changeSummaryUtils.js";

// 按顺序执行局部短路步骤：命中即返回 true；全部失败时汇总失败原因。
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

// 统一拼接“布局属性局部短路命中”日志字段。
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
