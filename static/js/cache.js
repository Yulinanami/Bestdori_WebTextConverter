// cache.js - 缓存管理模块

export class ResultCache {
  constructor(maxSize = 50, maxAge = 300000) {
    // 默认5分钟过期
    this.cache = new Map();
    this.maxSize = maxSize;
    this.maxAge = maxAge;
    this.accessOrder = []; // 记录访问顺序用于LRU
  }

  // 生成缓存键
  generateKey(text, config) {
    const configStr = JSON.stringify({
      narrator: config.narratorName,
      quotes: config.selectedQuotePairs,
      mapping: config.characterMapping,
      live2d: config.enableLive2D,
      costume: config.costumeMapping,
      position: config.positionConfig,
    });

    // 使用简单的哈希函数
    return this.simpleHash(text + configStr);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  set(key, value) {
    // 如果已存在，先删除旧的
    if (this.cache.has(key)) {
      this.cache.delete(key);
      const index = this.accessOrder.indexOf(key);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }

    // 检查大小限制
    if (this.cache.size >= this.maxSize) {
      // 删除最久未使用的项（LRU）
      const oldestKey = this.accessOrder.shift();
      this.cache.delete(oldestKey);
    }

    // 添加新项
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      size: JSON.stringify(value).length,
    });
    this.accessOrder.push(key);
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // 检查是否过期
    if (Date.now() - item.timestamp > this.maxAge) {
      this.delete(key);
      return null;
    }

    // 更新访问顺序（LRU）
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
      this.accessOrder.push(key);
    }

    return item.value;
  }

  delete(key) {
    this.cache.delete(key);
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  // 获取缓存统计信息
  getStats() {
    let totalSize = 0;
    let oldestTimestamp = Date.now();

    this.cache.forEach((item) => {
      totalSize += item.size;
      if (item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp;
      }
    });

    return {
      count: this.cache.size,
      totalSize: totalSize,
      oldestAge: Date.now() - oldestTimestamp,
      hitRate: this.calculateHitRate(),
    };
  }

  // 计算命中率
  calculateHitRate() {
    if (!this.requests) this.requests = 0;
    if (!this.hits) this.hits = 0;

    return this.requests > 0
      ? ((this.hits / this.requests) * 100).toFixed(2) + "%"
      : "0%";
  }
}

// 预编译结果缓存
export class PreviewCache extends ResultCache {
  constructor() {
    super(30, 600000);
  }

  // 针对预览的特殊优化
  generatePreviewKey(text, config) {
    // 预览只需要考虑影响结果的关键配置
    const essentialConfig = {
      narrator: config.narratorName,
      quotes: config.selectedQuotePairs,
      live2d: config.enableLive2D,
    };

    // 对文本进行简化哈希
    const textHash = this.quickHash(text);
    const configHash = this.quickHash(JSON.stringify(essentialConfig));

    return `${textHash}-${configHash}`;
  }

  quickHash(str) {
    // 更快的哈希算法用于预览
    return str
      .split("")
      .reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0)
      .toString(36);
  }
}
