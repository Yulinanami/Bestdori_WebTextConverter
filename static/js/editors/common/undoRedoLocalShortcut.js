import { perfLog } from "@editors/common/perfLogger.js";

// 文本展示裁剪：日志里避免超长字段刷屏。
function shortenText(text, maxLength = 48) {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

// 统一把不同类型值转成可读日志文本。
function formatValue(value) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return `"${shortenText(value)}"`;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    const json = JSON.stringify(value);
    if (!json) return "null";
    if (json.length <= 96) return json;
    return `${json.slice(0, 96)}...`;
  } catch {
    return String(value);
  }
}

// 按 path 片段读取嵌套值（用于 patch 前后值对比）。
function getValueBySegments(target, segments) {
  let current = target;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

// 把 path 片段转成可读路径：如 ["position","to","offsetX"] -> position.to.offsetX。
function formatSegments(segments) {
  let output = "";
  segments.forEach((segment) => {
    if (Number.isInteger(segment)) {
      output += `[${segment}]`;
      return;
    }
    output += output ? `.${segment}` : String(segment);
  });
  return output || "(root)";
}

// 把说话人数组压缩成简短摘要。
function summarizeSpeakers(speakers = []) {
  if (speakers.length === 0) {
    return "[]";
  }
  return speakers
    .map((speaker) => speaker.name || `ID:${speaker.characterId}`)
    .join("|");
}

// 生成 action 摘要，供增删日志直接打印关键信息。
function summarizeAction(action) {
  if (!action) {
    return "action=unknown";
  }
  if (action.type === "talk") {
    const motionsCount = action.motions ? action.motions.length : 0;
    return `type=talk, id=${action.id}, text=${formatValue(action.text || "")}, speakers=${summarizeSpeakers(
      action.speakers || [],
    )}, motions=${motionsCount}`;
  }
  if (action.type === "layout") {
    const fromPosition = action.position ? action.position.from : undefined;
    const toPosition = action.position ? action.position.to : undefined;
    return `type=layout, id=${action.id}, character=${action.characterName || action.characterId || "?"}, layoutType=${
      action.layoutType || "unknown"
    }, costume=${formatValue(action.costume || "")}, from=${formatValue(
      fromPosition,
    )}, to=${formatValue(toPosition)}, delay=${formatValue(action.delay)}`;
  }
  return `type=${action.type || "unknown"}, id=${action.id || "unknown"}`;
}

// 比较 actions 前后列表：识别新增、删除和纯排序变化。
function analyzeActionDiff(beforeActions, afterActions) {
  const beforeIdSet = new Set(beforeActions.map((action) => action.id));
  const afterIdSet = new Set(afterActions.map((action) => action.id));

  const addedIds = afterActions
    .map((action) => action.id)
    .filter((id) => !beforeIdSet.has(id));
  const removedIds = beforeActions
    .map((action) => action.id)
    .filter((id) => !afterIdSet.has(id));

  const orderChanged =
    addedIds.length === 0 &&
    removedIds.length === 0 &&
    beforeActions.length === afterActions.length &&
    beforeActions.some((action, index) => action.id !== afterActions[index].id);

  return { addedIds, removedIds, orderChanged };
}

// 从 action 相关 patch 中收集“受影响 actionId”集合。
function collectTouchedActionIds(actionPaths, beforeActions, afterActions) {
  const touchedActionIds = new Set();
  actionPaths.forEach((patch) => {
    const actionIndex = patch.path[1];
    const beforeAction = beforeActions[actionIndex];
    const afterAction = afterActions[actionIndex];
    if (beforeAction) touchedActionIds.add(beforeAction.id);
    if (afterAction) touchedActionIds.add(afterAction.id);
  });
  return touchedActionIds;
}

// 抽取单个 action 的字段变化明细（路径 + 前后值）。
function collectActionChangeDetails(actionPaths, beforeAction, afterAction) {
  const details = [];
  const seenPath = new Set();
  actionPaths.forEach((patch) => {
    const segments = patch.path.slice(2);
    if (!segments.length) {
      return;
    }
    const pathText = formatSegments(segments);
    if (seenPath.has(pathText)) {
      return;
    }
    seenPath.add(pathText);
    details.push({
      path: pathText,
      rootKey: String(segments[0]),
      beforeValue: getValueBySegments(beforeAction, segments),
      afterValue: getValueBySegments(afterAction, segments),
    });
  });
  return details;
}

// 过滤并格式化字段变化，避免一次打印过多细节。
function formatChangeDetails(changeDetails, filterKeys, limit = 4) {
  const filtered = changeDetails.filter((detail) =>
    filterKeys.includes(detail.rootKey)
  );
  if (!filtered.length) {
    return "";
  }
  const head = filtered
    .slice(0, limit)
    .map(
      (detail) =>
        `${detail.path}: ${formatValue(detail.beforeValue)} -> ${formatValue(detail.afterValue)}`,
    )
    .join("; ");
  if (filtered.length <= limit) {
    return head;
  }
  return `${head}; ...+${filtered.length - limit}`;
}

// 汇总排序变化（仅显示前几项）。
function summarizeOrderChange(beforeIndexById, afterIndexById) {
  const movedItems = [];
  beforeIndexById.forEach((beforeIndex, actionId) => {
    const afterIndex = afterIndexById.get(actionId);
    if (Number.isInteger(afterIndex) && afterIndex !== beforeIndex) {
      movedItems.push({ actionId, beforeIndex, afterIndex });
    }
  });
  if (!movedItems.length) {
    return "";
  }
  const preview = movedItems
    .slice(0, 4)
    .map(
      (item) => `${item.actionId}: ${item.beforeIndex} -> ${item.afterIndex}`,
    )
    .join("; ");
  if (movedItems.length <= 4) {
    return preview;
  }
  return `${preview}; ...+${movedItems.length - 4}`;
}

// 给编辑器注入“undo/redo 的局部短路标记”能力。
export function attachUndoRedoLocalShortcut(baseEditor, handlers = {}) {
  const {
    debugTag = "undoRedo",
    onActionAdded,
    onActionRemoved,
    onActionOrderChanged,
    onTextChanged,
    onSpeakerFieldChanged,
    onLayoutFieldChanged,
    onExpressionFieldChanged,
  } = handlers;
  const debugPrefix = `[PERF][${debugTag}]`;

  const layoutKeys = new Set([
    "layoutType",
    "costume",
    "position",
    "customToPosition",
    "characterId",
    "characterName",
  ]);
  const speakerKeys = new Set(["speakers"]);
  const expressionKeys = new Set(["motions", "initialState", "delay"]);
  const layoutKeyList = Array.from(layoutKeys);
  const speakerKeyList = Array.from(speakerKeys);
  const expressionKeyList = Array.from(expressionKeys);

  const previousResolver = baseEditor.commandRenderHintResolver;
  baseEditor.commandRenderHintResolver = (context) => {
    previousResolver?.(context);

    const { phase, stateBefore, stateAfter, patchesApplied } = context;
    if (phase !== "undo" && phase !== "redo") {
      return;
    }
    const phaseLabel = phase === "undo" ? "撤销" : "恢复";
    perfLog(
      `${debugPrefix}[撤销恢复] 开始: 操作=${phaseLabel}, phase=${phase}, patches=${patchesApplied.length}`,
    );

    const beforeActions = stateBefore.actions;
    const afterActions = stateAfter.actions;
    const beforeIndexById = new Map(
      beforeActions.map((action, index) => [action.id, index]),
    );
    const afterIndexById = new Map(
      afterActions.map((action, index) => [action.id, index]),
    );
    const beforeActionById = new Map(
      beforeActions.map((action) => [action.id, action]),
    );
    const afterActionById = new Map(
      afterActions.map((action) => [action.id, action]),
    );

    const { addedIds, removedIds, orderChanged } = analyzeActionDiff(
      beforeActions,
      afterActions,
    );

    // 第一步：先处理“增删排序”这类结构变化。
    if (addedIds.length === 1 && removedIds.length === 0 && onActionAdded) {
      const actionId = addedIds[0];
      const actionAfter = afterActionById.get(actionId);
      const summary = summarizeAction(actionAfter);
      perfLog(
        `${debugPrefix}[撤销恢复] 命中卡片新增: 操作=${phaseLabel}, action=${actionId}, 详情=${summary}`,
      );
      onActionAdded({
        phase,
        actionId,
        actionAfter,
        indexAfter: afterIndexById.get(actionId),
        summary,
      });
    }

    if (removedIds.length === 1 && addedIds.length === 0 && onActionRemoved) {
      const actionId = removedIds[0];
      const actionBefore = beforeActionById.get(actionId);
      const summary = summarizeAction(actionBefore);
      perfLog(
        `${debugPrefix}[撤销恢复] 命中卡片删除: 操作=${phaseLabel}, action=${actionId}, 详情=${summary}`,
      );
      onActionRemoved({
        phase,
        actionId,
        actionBefore,
        indexBefore: beforeIndexById.get(actionId),
        summary,
      });
    }

    if (orderChanged && onActionOrderChanged) {
      const orderSummary = summarizeOrderChange(
        beforeIndexById,
        afterIndexById,
      );
      perfLog(
        `${debugPrefix}[撤销恢复] 命中排序变化: 操作=${phaseLabel}, 详情=${orderSummary || "无"}`,
      );
      onActionOrderChanged({ phase, orderSummary });
    }

    if (addedIds.length || removedIds.length) {
      perfLog(`${debugPrefix}[撤销恢复] 跳过字段级判定: 原因=已处理增删`);
      return;
    }

    // 第二步：仅在“单个 action 字段变化”时做字段级短路标记。
    const actionPaths = patchesApplied.filter(
      (patch) => patch.path[0] === "actions" && Number.isInteger(patch.path[1]),
    );
    const touchedActionIds = collectTouchedActionIds(
      actionPaths,
      beforeActions,
      afterActions,
    );
    if (touchedActionIds.size !== 1) {
      perfLog(
        `${debugPrefix}[撤销恢复] 跳过字段级判定: touchedActions=${touchedActionIds.size}`,
      );
      return;
    }

    const [actionId] = touchedActionIds;
    const actionBefore = beforeActionById.get(actionId);
    const actionAfter = afterActionById.get(actionId);
    if (!actionAfter) {
      perfLog(
        `${debugPrefix}[撤销恢复] 跳过字段级判定: 原因=actionAfter 不存在`,
      );
      return;
    }
    const changeDetails = collectActionChangeDetails(
      actionPaths,
      actionBefore,
      actionAfter,
    );

    if (
      actionPaths.some((patch) => patch.path[2] === "text") &&
      onTextChanged
    ) {
      const detailText = formatChangeDetails(changeDetails, ["text"]);
      perfLog(
        `${debugPrefix}[撤销恢复] 命中文本字段: 操作=${phaseLabel}, action=${actionId}, 变更=${detailText || "无"}`,
      );
      onTextChanged({
        phase,
        actionId,
        actionBefore,
        actionAfter,
        changes: changeDetails,
      });
    }

    if (
      actionPaths.some((patch) => speakerKeys.has(String(patch.path[2]))) &&
      onSpeakerFieldChanged
    ) {
      const detailText = formatChangeDetails(changeDetails, speakerKeyList);
      perfLog(
        `${debugPrefix}[撤销恢复] 命中说话人字段: 操作=${phaseLabel}, action=${actionId}, 变更=${detailText || "无"}`,
      );
      onSpeakerFieldChanged({
        phase,
        actionId,
        actionBefore,
        actionAfter,
        changes: changeDetails,
      });
    }

    if (
      actionPaths.some((patch) => layoutKeys.has(String(patch.path[2]))) &&
      onLayoutFieldChanged
    ) {
      const detailText = formatChangeDetails(changeDetails, layoutKeyList);
      perfLog(
        `${debugPrefix}[撤销恢复] 命中布局字段: 操作=${phaseLabel}, action=${actionId}, 变更=${detailText || "无"}`,
      );
      onLayoutFieldChanged({
        phase,
        actionId,
        actionBefore,
        actionAfter,
        changes: changeDetails,
      });
    }

    if (
      actionPaths.some((patch) => expressionKeys.has(String(patch.path[2]))) &&
      onExpressionFieldChanged
    ) {
      const detailText = formatChangeDetails(changeDetails, expressionKeyList);
      perfLog(
        `${debugPrefix}[撤销恢复] 命中动作/表情字段: 操作=${phaseLabel}, action=${actionId}, 变更=${detailText || "无"}`,
      );
      onExpressionFieldChanged({
        phase,
        actionId,
        actionBefore,
        actionAfter,
        changes: changeDetails,
      });
    }
  };
}
