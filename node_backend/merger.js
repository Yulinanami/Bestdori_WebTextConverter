// 文件合并逻辑：bestdori 结果合并 + 项目进度合并
const cloneDeep = (value) => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const generateTimestamp = () => Date.now() + Math.floor(Math.random() * 10000);

const mergeBestdori = (files) => {
  // 严格按 server -> voice -> background -> bgm -> actions 输出
  const base = files[0].data || {};
  const merged = {
    server: base.server ?? 0,
    voice: base.voice ?? "",
    background: base.background ?? null,
    bgm: base.bgm ?? null,
    actions: [],
  };

  for (const entry of files) {
    const actions = Array.isArray(entry?.data?.actions) ? entry.data.actions : [];
    merged.actions.push(...actions);
  }

  return merged;
};

const mergeProject = (files) => {
  // 严格按 version -> actions 输出，并重建 action id 防冲突
  const base = files[0].data || {};
  const merged = {
    version: base.version ?? "1.0",
    actions: [],
  };

  for (const entry of files) {
    const clonedActions = cloneDeep(Array.isArray(entry?.data?.actions) ? entry.data.actions : []);
    clonedActions.forEach((action, index) => {
      const timestamp = generateTimestamp() + index;
      const actionType = action?.type ?? "";
      if (actionType === "talk") {
        action.id = `action-id-${timestamp}-${index}`;
      } else if (actionType === "layout") {
        const charId = action?.characterId ?? 0;
        action.id = `layout-action-${timestamp}-${charId}-${index}`;
      } else {
        action.id = `action-${timestamp}-${index}`;
      }
    });
    merged.actions.push(...clonedActions);
  }

  return merged;
};

module.exports = { mergeBestdori, mergeProject };
