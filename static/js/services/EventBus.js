// 事件总线 - 用于模块间解耦通信
class EventBus {
  constructor() {
    this.debugMode = false;
  }

  setDebug(enabled) {
    this.debugMode = enabled;
  }

  emit(eventName, data = null) {
    if (this.debugMode) {
      console.log(`[EventBus] 触发事件: ${eventName}`, data);
    }
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
