// 模块间通信的事件总线
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  // 注册事件监听
  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
  }

  // 触发事件，通知所有监听者
  emit(eventName, data) {
    const callbacks = this.listeners.get(eventName);
    if (!callbacks) return;
    callbacks.forEach((callback) => callback(data));
  }
}

export const eventBus = new EventBus();
