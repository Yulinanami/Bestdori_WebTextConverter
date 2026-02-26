import { assignmentRenderer } from "@editors/expression/expressionAssignmentRenderer.js";
import { perfLog } from "@editors/common/perfLogger.js";

// 动作/表情编辑器：卡片底部分配区的局部短路刷新。
export function attachExpressionCardLocalRefresh(editor) {
  const debugPrefix = "[PERF][expressionCard]";
  // 把 detail 入参统一转成字符串，便于日志直出。
  const normalizeDetail = (detail) => {
    if (!detail) return "";
    if (typeof detail === "string") return detail;
    try {
      return JSON.stringify(detail);
    } catch {
      return String(detail);
    }
  };

  Object.assign(editor, {
    pendingExpressionCardRenders: new Map(),

    // 标记“下次渲染优先局部刷新这张卡片的分配区”。
    markExpressionCardRender(actionId, options = {}) {
      if (!actionId) {
        return;
      }
      const existing = this.pendingExpressionCardRenders.get(actionId) || {};
      const nextOperations = (existing.operations || []).slice();
      const nextDetails = (existing.details || []).slice();
      if (options.operation && !nextOperations.includes(options.operation)) {
        nextOperations.push(options.operation);
      }
      const detailText = normalizeDetail(options.detail);
      if (detailText && !nextDetails.includes(detailText)) {
        nextDetails.push(detailText);
      }
      this.pendingExpressionCardRenders.set(actionId, {
        operations: nextOperations,
        details: nextDetails,
      });
      const logParts = [
        `action=${actionId}`,
        `op=${options.operation || "unknown"}`,
      ];
      if (detailText) {
        logParts.push(`detail=${detailText}`);
      }
      perfLog(`${debugPrefix}[局部候选] 标记卡片刷新: ${logParts.join(", ")}`);
    },

    // 返回本轮待刷新的简要摘要，供编辑器主日志打印。
    peekPendingExpressionCardSummary(limit = 2) {
      const entries = Array.from(this.pendingExpressionCardRenders.entries());
      if (!entries.length) {
        return "";
      }
      const summary = entries
        .slice(0, limit)
        .map(([actionId, options]) => {
          const operations = (options.operations || []).join("|") || "unknown";
          const detail = (options.details || []).join(" | ");
          return `action=${actionId}, op=${operations}${
            detail ? `, detail=${detail}` : ""
          }`;
        })
        .join("; ");
      if (entries.length <= limit) {
        return summary;
      }
      return `${summary}; ...+${entries.length - limit}`;
    },

    // 逐张卡片尝试局部刷新分配区；失败才回退全量渲染。
    applyPendingExpressionCardRender() {
      const pendingRenders = this.pendingExpressionCardRenders;
      if (pendingRenders.size === 0) {
        return false;
      }
      this.pendingExpressionCardRenders = new Map();

      const timeline = this.domCache.timeline;
      const actions = this.projectFileState.actions;
      if (!timeline || !actions.length) {
        perfLog(`${debugPrefix}[局部短路] 失败: 原因=timeline 或 actions 不可用`);
        return false;
      }

      for (const [actionId, options] of pendingRenders.entries()) {
        const action = actions.find((actionItem) => actionItem.id === actionId);
        if (!action) {
          perfLog(
            `${debugPrefix}[局部短路] 失败: 原因=未找到 action, action=${actionId}`
          );
          return false;
        }
        const cardElement = timeline.querySelector(
          `.timeline-item[data-id="${actionId}"]`
        );
        if (!cardElement) {
          perfLog(
            `${debugPrefix}[局部短路] 失败: 原因=未找到卡片, action=${actionId}`
          );
          return false;
        }
        const applied = assignmentRenderer.renderCardFooter(
          this,
          cardElement,
          { ...options, action }
        );
        if (!applied) {
          perfLog(
            `${debugPrefix}[局部短路] 失败: 原因=footer 渲染失败, action=${actionId}`
          );
          return false;
        }
        const operations = (options.operations || []).join("|") || "unknown";
        const logParts = [
          `action=${actionId}`,
          `type=${action.type}`,
          `op=${operations}`,
        ];
        if ((options.details || []).length) {
          logParts.push(`detail=${options.details.join(" | ")}`);
        }
        perfLog(`${debugPrefix}[局部短路] 命中卡片刷新: ${logParts.join(", ")}`);
      }

      perfLog(
        `${debugPrefix}[局部短路] 本轮完成: count=${pendingRenders.size}`
      );
      return true;
    },
  });
}
