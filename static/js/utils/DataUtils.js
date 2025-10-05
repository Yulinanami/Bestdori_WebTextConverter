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
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * 深度合并对象
   * @param {object} target - 目标对象
   * @param  {...object} sources - 源对象
   * @returns {object}
   */
  deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (this.isObject(source[key])) {
          if (!target[key]) Object.assign(target, { [key]: {} });
          this.deepMerge(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      });
    }

    return this.deepMerge(target, ...sources);
  },

  /**
   * 检查是否为对象
   * @param {any} item - 要检查的项
   * @returns {boolean}
   */
  isObject(item) {
    return item && typeof item === "object" && !Array.isArray(item);
  },

  /**
   * 数组去重
   * @param {Array} arr - 输入数组
   * @param {string|Function} key - 去重键或函数
   * @returns {Array}
   */
  unique(arr, key = null) {
    if (!key) {
      return [...new Set(arr)];
    }

    const seen = new Set();
    return arr.filter((item) => {
      const k = typeof key === "function" ? key(item) : item[key];
      if (seen.has(k)) {
        return false;
      }
      seen.add(k);
      return true;
    });
  },

  /**
   * 数组分组
   * @param {Array} arr - 输入数组
   * @param {string|Function} key - 分组键或函数
   * @returns {object}
   */
  groupBy(arr, key) {
    return arr.reduce((result, item) => {
      const group = typeof key === "function" ? key(item) : item[key];
      if (!result[group]) {
        result[group] = [];
      }
      result[group].push(item);
      return result;
    }, {});
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
   * 数组分块
   * @param {Array} arr - 输入数组
   * @param {number} size - 块大小
   * @returns {Array<Array>}
   */
  chunk(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  },

  /**
   * 对象转数组
   * @param {object} obj - 输入对象
   * @param {string} keyName - 键的属性名
   * @param {string} valueName - 值的属性名
   * @returns {Array}
   */
  objectToArray(obj, keyName = "key", valueName = "value") {
    return Object.entries(obj).map(([k, v]) => ({
      [keyName]: k,
      [valueName]: v,
    }));
  },

  /**
   * 数组转对象
   * @param {Array} arr - 输入数组
   * @param {string|Function} keyField - 键字段或函数
   * @returns {object}
   */
  arrayToObject(arr, keyField) {
    return arr.reduce((result, item) => {
      const key = typeof keyField === "function" ? keyField(item) : item[keyField];
      result[key] = item;
      return result;
    }, {});
  },

  /**
   * 提取对象的指定字段
   * @param {object} obj - 输入对象
   * @param {Array<string>} fields - 要提取的字段
   * @returns {object}
   */
  pick(obj, fields) {
    return fields.reduce((result, field) => {
      if (obj.hasOwnProperty(field)) {
        result[field] = obj[field];
      }
      return result;
    }, {});
  },

  /**
   * 排除对象的指定字段
   * @param {object} obj - 输入对象
   * @param {Array<string>} fields - 要排除的字段
   * @returns {object}
   */
  omit(obj, fields) {
    const result = { ...obj };
    fields.forEach((field) => delete result[field]);
    return result;
  },

  /**
   * 检查对象是否为空
   * @param {object} obj - 输入对象
   * @returns {boolean}
   */
  isEmpty(obj) {
    return Object.keys(obj).length === 0;
  },

  /**
   * 扁平化嵌套对象
   * @param {object} obj - 输入对象
   * @param {string} separator - 分隔符
   * @returns {object}
   */
  flatten(obj, separator = ".") {
    const result = {};

    function recurse(current, prefix = "") {
      Object.entries(current).forEach(([key, value]) => {
        const newKey = prefix ? `${prefix}${separator}${key}` : key;
        if (DataUtils.isObject(value)) {
          recurse(value, newKey);
        } else {
          result[newKey] = value;
        }
      });
    }

    recurse(obj);
    return result;
  },

  /**
   * 安全地获取嵌套属性
   * @param {object} obj - 输入对象
   * @param {string} path - 属性路径（如 "a.b.c"）
   * @param {any} defaultValue - 默认值
   * @returns {any}
   */
  get(obj, path, defaultValue = undefined) {
    const keys = path.split(".");
    let result = obj;

    for (const key of keys) {
      if (result && typeof result === "object" && key in result) {
        result = result[key];
      } else {
        return defaultValue;
      }
    }

    return result;
  },

  /**
   * 安全地设置嵌套属性
   * @param {object} obj - 输入对象
   * @param {string} path - 属性路径
   * @param {any} value - 值
   */
  set(obj, path, value) {
    const keys = path.split(".");
    const lastKey = keys.pop();
    let current = obj;

    for (const key of keys) {
      if (!current[key] || typeof current[key] !== "object") {
        current[key] = {};
      }
      current = current[key];
    }

    current[lastKey] = value;
  },
};
