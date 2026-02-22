// 常用数据工具：深拷贝、排序、生成轻量签名等。

export const DataUtils = {
  // 深拷贝：避免改动一个对象时把原对象也改了
  deepClone(sourceValue) {
    if (sourceValue === null || typeof sourceValue !== "object") {
      return sourceValue;
    }
    if (typeof structuredClone === "function") {
      return structuredClone(sourceValue);
    }
    return JSON.parse(JSON.stringify(sourceValue));
  },

  // 排序：按一个或多个字段/函数来排序（不修改原数组）
  sortBy(sourceList, keys, orders = "asc") {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    const orderArray = Array.isArray(orders) ? orders : [orders];

    return [...sourceList].sort((leftItem, rightItem) => {
      for (const [keyIndex, key] of keyArray.entries()) {
        const order = orderArray[keyIndex] || "asc";
        const leftValue =
          typeof key === "function" ? key(leftItem) : leftItem[key];
        const rightValue =
          typeof key === "function" ? key(rightItem) : rightItem[key];

        if (leftValue < rightValue) return order === "asc" ? -1 : 1;
        if (leftValue > rightValue) return order === "asc" ? 1 : -1;
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
        speakers: (action.speakers || []).map((speaker) => ({
          id: speaker.characterId,
          name: speaker.name,
        })),
        motions: (action.motions || []).map((motionAssignment) => ({
          c: motionAssignment.character,
          m: motionAssignment.motion,
          e: motionAssignment.expression,
          d: motionAssignment.delay,
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
        independent: action.customToPosition || false,
      });
    }

    return JSON.stringify(action);
  },

  // 给对象生成一个“浅层签名”（用于快速判断配置是否变化）
  shallowSignature(sourceObject) {
    if (!sourceObject || typeof sourceObject !== "object") return "";
    const sorted = Object.keys(sourceObject)
      .sort()
      .map((key) => [key, sourceObject[key]]);
    return JSON.stringify(sorted);
  },
};
