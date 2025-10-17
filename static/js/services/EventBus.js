// 事件总线 - 用于模块间解耦通信
class EventBus {
  constructor() {
    this.events = {};
    this.debugMode = false;
  }

  setDebug(enabled) {
    this.debugMode = enabled;
  }

  /**
   * 订阅事件
   * @param {string} eventName - 事件名
   * @param {Function} callback - 回调函数
   * @param {object} options - {once: boolean} 是否只执行一次
   * @returns {Function} 取消订阅函数
   */
  on(eventName, callback, options = {}) {
    if (typeof callback !== "function") {
      console.error("[EventBus] 回调必须是函数");
      return () => {};
    }

    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }

    const listener = {
      callback,
      once: options.once || false,
    };

    this.events[eventName].push(listener);

    if (this.debugMode) {
      console.log(
        `[EventBus] 订阅事件: ${eventName} (当前监听器数: ${this.events[eventName].length})`
      );
    }

    // 返回取消订阅函数
    return () => this.off(eventName, callback);
  }

  once(eventName, callback) {
    return this.on(eventName, callback, { once: true });
  }

  /**
   * 取消订阅 - 不传callback则取消该事件的所有订阅
   */
  off(eventName, callback = null) {
    if (!this.events[eventName]) {
      return;
    }

    if (callback === null) {
      // 取消所有订阅
      delete this.events[eventName];
      if (this.debugMode) {
        console.log(`[EventBus] 取消所有订阅: ${eventName}`);
      }
    } else {
      // 取消特定回调
      this.events[eventName] = this.events[eventName].filter(
        (listener) => listener.callback !== callback
      );

      if (this.events[eventName].length === 0) {
        delete this.events[eventName];
      }

      if (this.debugMode) {
        console.log(`[EventBus] 取消订阅: ${eventName}`);
      }
    }
  }

  emit(eventName, data = null) {
    if (!this.events[eventName]) {
      if (this.debugMode) {
        console.log(`[EventBus] 无监听器: ${eventName}`);
      }
      return;
    }

    if (this.debugMode) {
      console.log(`[EventBus] 触发事件: ${eventName}`, data);
    }

    // 复制监听器列表，避免在执行过程中修改
    const listeners = [...this.events[eventName]];

    listeners.forEach((listener) => {
      try {
        listener.callback(data);

        // 如果是一次性监听器，执行后移除
        if (listener.once) {
          this.off(eventName, listener.callback);
        }
      } catch (error) {
        console.error(`[EventBus] 事件处理错误 (${eventName}):`, error);
      }
    });
  }

  getEventNames() {
    return Object.keys(this.events);
  }

  getListenerCount(eventName) {
    return this.events[eventName]?.length || 0;
  }

  clear() {
    this.events = {};
    if (this.debugMode) {
      console.log("[EventBus] 已清空所有监听器");
    }
  }

  /**
   * 等待事件触发,返回Promise
   * @param {number} timeout - 超时时间(ms), 0表示不超时
   */
  waitFor(eventName, timeout = 0) {
    return new Promise((resolve, reject) => {
      let timeoutId = null;

      const unsubscribe = this.once(eventName, (data) => {
        if (timeoutId) clearTimeout(timeoutId);
        resolve(data);
      });

      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          unsubscribe();
          reject(new Error(`等待事件超时: ${eventName}`));
        }, timeout);
      }
    });
  }
}

// 导出单例
export const eventBus = new EventBus();

// 定义常用事件名称常量
export const EVENTS = {
  // 状态相关
  STATE_CHANGED: "state:changed",

  // 配置相关
  CONFIG_LOADED: "config:loaded",
  CONFIG_SAVED: "config:saved",
  CONFIG_RESET: "config:reset",

  // 转换相关
  CONVERT_START: "convert:start",
  CONVERT_SUCCESS: "convert:success",
  CONVERT_ERROR: "convert:error",

  // 文件相关
  FILE_UPLOADED: "file:uploaded",
  FILE_DOWNLOADED: "file:downloaded",

  // 模态框相关
  MODAL_OPENED: "modal:opened",
  MODAL_CLOSED: "modal:closed",

  // UI 相关
  PROGRESS_UPDATE: "ui:progress",
  STATUS_MESSAGE: "ui:status",

  // 服装相关
  COSTUME_CHANGED: "costume:changed",
  COSTUME_SAVED: "costume:saved",

  // 位置相关
  POSITION_CHANGED: "position:changed",
  POSITION_SAVED: "position:saved",
};
