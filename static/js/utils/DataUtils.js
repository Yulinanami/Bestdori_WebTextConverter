// 常用数据工具：深拷贝、排序、生成轻量签名等。

export const DataUtils = {
  // 深拷贝：避免改动一个对象时把原对象也改了
  deepClone(obj) {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    if (typeof structuredClone === "function") {
      return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
  },

  // 排序：按一个或多个字段/函数来排序（不修改原数组）
  sortBy(arr, keys, orders = "asc") {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    const orderArray = Array.isArray(orders) ? orders : [orders];

    return [...arr].sort((a, b) => {
      for (let i = 0; i < keyArray.length; i++) {
        const key = keyArray[i];
        const order = orderArray[i] || "asc";
        const aVal = typeof key === "function" ? key(a) : a[key];
        const bVal = typeof key === "function" ? key(b) : b[key];

        if (aVal < bVal) return order === "asc" ? -1 : 1;
        if (aVal > bVal) return order === "asc" ? 1 : -1;
      }
      return 0;
    });
  },

  // 给 action 生成“轻量签名”：用于判断卡片是否需要重新渲染
  actionSignature(action) {
    if (!action || typeof action !== "object") return "";
    if (action.type === "talk") {
      return JSON.stringify({
        id: action.id,
        type: action.type,
        text: action.text,
        speakers: (action.speakers || []).map((s) => ({
          id: s.characterId,
          name: s.name,
        })),
        motions: (action.motions || []).map((m) => ({
          c: m.character,
          m: m.motion,
          e: m.expression,
          d: m.delay,
        })),
      });
    }

    if (action.type === "layout") {
      const position = action.position || {};
      return JSON.stringify({
        id: action.id,
        type: action.type,
        layoutType: action.layoutType,
        characterId: action.characterId,
        characterName: action.characterName,
        costume: action.costume,
        positionFrom: position.from || null,
        positionTo: position.to || null,
        initialState: action.initialState || null,
        delay: action.delay,
        independent: action._independentToPosition || false,
      });
    }

    return JSON.stringify(action);
  },

  // 给对象生成一个“浅层签名”（用于快速判断配置是否变化）
  shallowSignature(obj) {
    if (!obj || typeof obj !== "object") return "";
    const sorted = Object.keys(obj)
      .sort()
      .map((key) => [key, obj[key]]);
    return JSON.stringify(sorted);
  },
};
