/**
 * DataUtils - 数据处理工具函数
 */

export const DataUtils = {
  /**
   * 深拷贝对象
   * @param {any} obj - 要拷贝的对象
   * @returns {any}
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    if (typeof structuredClone === "function") {
      return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * 数组排序（支持多字段）
   * @param {Array} arr - 输入数组
   * @param {string|Array} keys - 排序键
   * @param {string|Array} orders - 排序顺序 ('asc' | 'desc')
   * @returns {Array}
   */
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

  /**
   * 生成轻量签名（用于增量渲染）
   * 针对 action 选取核心字段，避免全量 stringify
   * @param {Object} action
   * @returns {string}
   */
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

  /**
   * 对象哈希（浅层字段排序后 stringify）
   * 用于 contextSignature 等轻量对比
   * @param {Object} obj
   * @returns {string}
   */
  shallowSignature(obj) {
    if (!obj || typeof obj !== "object") return "";
    const sorted = Object.keys(obj)
      .sort()
      .map((key) => [key, obj[key]]);
    return JSON.stringify(sorted);
  },
};
