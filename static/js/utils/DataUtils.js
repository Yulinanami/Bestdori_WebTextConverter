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
};
