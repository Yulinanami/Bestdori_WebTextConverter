// 处理撤销重做的局部刷新
import { perfLog } from "@editors/common/perfLogger.js";

// 截短长文本
function shortenText(text, maxLength = 48) {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

// 把值转成日志文本
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

// 按路径取值
function readValueBySegments(target, segments) {
  let current = target;
  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

// 把路径片段转成字符串
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

// 压缩说话人列表
function summarizeSpeakers(speakers = []) {
  if (speakers.length === 0) {
    return "[]";
  }
  return speakers
    .map((speaker) => speaker.name || `ID:${speaker.characterId}`)
    .join("|");
}

// 整理 action 摘要
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

// 比较 action 列表
function analyzeActionDiff(beforeActions, afterActions) {
  const beforeIdSet = new Set(beforeActions.map((action) => action.id));
  const afterIdSet = new Set(afterActions.map((action) => action.id));

  const addedIds = afterActions
    .map((action) => action.id)
    .filter((id) => !beforeIdSet.has(id));
  const removedIds = beforeActions
    .map((action) => action.id)
    .filter((id) => !afterIdSet.has(id));

  // 只有没有增删时 才把同长度不同顺序算成重排
  const orderChanged =
    addedIds.length === 0 &&
    removedIds.length === 0 &&
    beforeActions.length === afterActions.length &&
    beforeActions.some((action, index) => action.id !== afterActions[index].id);

  return { addedIds, removedIds, orderChanged };
}

// 收集受影响的 action id
function collectTouchedIds(actionPaths, beforeActions, afterActions) {
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

// 收集 action 字段变化
function collectActionChanges(actionPaths, beforeAction, afterAction) {
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
    // 同一路径只记一次 避免日志重复
    seenPath.add(pathText);
    details.push({
      path: pathText,
      rootKey: String(segments[0]),
      beforeValue: readValueBySegments(beforeAction, segments),
      afterValue: readValueBySegments(afterAction, segments),
    });
  });
  return details;
}

// 整理字段变化文本
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

// 整理排序变化
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

// 挂撤销重做局部刷新
export function attachUndoRedo(editor, handlers = {}) {
  const {
    debugTag = "undoRedo",
    onActionAdded,
    onActionRemoved,
    onActionOrderChanged,
    onTextChanged,
    onSpeakerChange,
    onLayoutFieldChanged,
    onFieldChanged,
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

  const previousResolver = editor.renderHintResolver;
  editor.renderHintResolver = (context) => {
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

    // 第一步：先处理“增删排序”这类结构变化
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

    // 第二步：仅在“单个 action 字段变化”时做字段级短路标记
    const actionPaths = patchesApplied.filter(
      (patch) => patch.path[0] === "actions" && Number.isInteger(patch.path[1]),
    );
    const touchedActionIds = collectTouchedIds(
      actionPaths,
      beforeActions,
      afterActions,
    );

    const hasSpeakerChange = actionPaths.some((patch) =>
      speakerKeys.has(String(patch.path[2]))
    );
    const onlySpeakerChange =
      actionPaths.length > 0 &&
      actionPaths.every((patch) => speakerKeys.has(String(patch.path[2])));

    // 第三步：多 action 的撤销/恢复里，若仅改了 speakers 字段，走批量说话人局部短路
    if (touchedActionIds.size > 1) {
      if (onlySpeakerChange && onSpeakerChange) {
        const actionIds = Array.from(touchedActionIds);
        perfLog(
          `${debugPrefix}[撤销恢复] 命中说话人字段(批量): 操作=${phaseLabel}, actions=${actionIds.join("|")}`,
        );
        onSpeakerChange({
          phase,
          actionIds,
          changes: [],
        });
        return;
      }

      perfLog(
        `${debugPrefix}[撤销恢复] 跳过字段级判定: touchedActions=${touchedActionIds.size}`,
      );
      return;
    }

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
    // 第四步 再按字段类型把变化分发给对应的局部刷新
    const changeDetails = collectActionChanges(
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

    if (hasSpeakerChange && onSpeakerChange) {
      const detailText = formatChangeDetails(changeDetails, speakerKeyList);
      perfLog(
        `${debugPrefix}[撤销恢复] 命中说话人字段: 操作=${phaseLabel}, action=${actionId}, 变更=${detailText || "无"}`,
      );
      onSpeakerChange({
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
      onFieldChanged
    ) {
      const detailText = formatChangeDetails(changeDetails, expressionKeyList);
      perfLog(
        `${debugPrefix}[撤销恢复] 命中动作/表情字段: 操作=${phaseLabel}, action=${actionId}, 变更=${detailText || "无"}`,
      );
      onFieldChanged({
        phase,
        actionId,
        actionBefore,
        actionAfter,
        changes: changeDetails,
      });
    }
  };
}
