// 合并文件内容
// 深拷贝数据
const cloneDeep = (value) => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

// 生成临时用的时间戳
const generateTimestamp = () => Date.now() + Math.floor(Math.random() * 10000);

// 合并结果文件
const mergeBestdori = (files) => {
  // 按固定字段顺序输出
  const base = files[0].data || {};
  const merged = {
    server: base.server ?? 0,
    voice: base.voice ?? "",
    background: base.background ?? null,
    bgm: base.bgm ?? null,
    actions: [],
  };

  for (const entry of files) {
    const actions = Array.isArray(entry?.data?.actions)
      ? entry.data.actions
      : [];
    merged.actions.push(...actions);
  }

  return merged;
};

// 合并项目进度
const mergeProject = (files) => {
  // 按固定字段顺序输出并重建 action id
  const base = files[0].data || {};
  const merged = {
    version: base.version ?? "1.0",
    actions: [],
  };

  for (const entry of files) {
    const clonedActions = cloneDeep(
      Array.isArray(entry?.data?.actions) ? entry.data.actions : [],
    );
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
