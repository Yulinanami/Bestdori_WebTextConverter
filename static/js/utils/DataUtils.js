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

  /**
   * 生成增量补丁与反补丁
   * 仅使用 add/remove/replace 三种操作
   * @param {any} before
   * @param {any} after
   * @returns {{patches: Array, inversePatches: Array}}
   */
  generatePatches(before, after) {
    const patches = [];
    const inversePatches = [];
    const cloneValue = (val) => DataUtils.deepClone(val);

    const walk = (a, b, path = []) => {
      if (a === b) return;

      const aIsArray = Array.isArray(a);
      const bIsArray = Array.isArray(b);
      if (aIsArray && bIsArray) {
        const maxLen = Math.max(a.length, b.length);
        for (let i = 0; i < maxLen; i++) {
          if (i >= a.length) {
            patches.push({
              op: "add",
              path: [...path, i],
              value: cloneValue(b[i]),
            });
            inversePatches.push({ op: "remove", path: [...path, i] });
          } else if (i >= b.length) {
            patches.push({ op: "remove", path: [...path, i] });
            inversePatches.push({
              op: "add",
              path: [...path, i],
              value: cloneValue(a[i]),
            });
          } else {
            walk(a[i], b[i], [...path, i]);
          }
        }
        return;
      }

      const aIsObj = a && typeof a === "object";
      const bIsObj = b && typeof b === "object";
      if (aIsObj && bIsObj && !aIsArray && !bIsArray) {
        const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
        keys.forEach((key) => {
          if (!(key in b)) {
            patches.push({ op: "remove", path: [...path, key] });
            inversePatches.push({
              op: "add",
              path: [...path, key],
              value: cloneValue(a[key]),
            });
          } else if (!(key in a)) {
            patches.push({
              op: "add",
              path: [...path, key],
              value: cloneValue(b[key]),
            });
            inversePatches.push({ op: "remove", path: [...path, key] });
          } else {
            walk(a[key], b[key], [...path, key]);
          }
        });
        return;
      }

      // 基础值或类型变化
      patches.push({ op: "replace", path, value: cloneValue(b) });
      inversePatches.push({ op: "replace", path, value: cloneValue(a) });
    };

    walk(before, after);
    return { patches, inversePatches };
  },

  /**
   * 应用补丁到目标对象（原地修改）
   * @param {any} target
   * @param {Array} patches
   * @returns {any} 目标自身
   */
  applyPatches(target, patches = []) {
    let root = target;
    if (root === undefined || root === null) {
      root = {};
    }

    const ensureContainer = (obj, key) => {
      if (obj[key] === undefined) {
        obj[key] = typeof key === "number" ? [] : {};
      }
      return obj[key];
    };

    const getParent = (obj, path) => {
      let parent = obj;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        parent = ensureContainer(parent, key);
      }
      return parent;
    };

    // 删除操作需要从后往前，防止数组索引错位
    const sortedPatches = [
      ...patches.filter((p) => p.op === "remove").sort((a, b) => {
        const lenDiff = b.path.length - a.path.length;
        if (lenDiff !== 0) return lenDiff;
        const lastA = a.path[a.path.length - 1];
        const lastB = b.path[b.path.length - 1];
        return Number(lastB) - Number(lastA);
      }),
      ...patches.filter((p) => p.op !== "remove"),
    ];

    sortedPatches.forEach((patch) => {
      if (patch.path.length === 0) {
        if (patch.op === "remove") {
          root = undefined;
        } else {
          root = patch.value;
        }
        return;
      }

      const parent = getParent(root, patch.path);
      const key = patch.path[patch.path.length - 1];
      if (!parent) return;

      if (patch.op === "add" || patch.op === "replace") {
        parent[key] = patch.value;
      } else if (patch.op === "remove") {
        if (Array.isArray(parent)) {
          parent.splice(Number(key), 1);
        } else {
          delete parent[key];
        }
      }
    });
    return root;
  },
};
