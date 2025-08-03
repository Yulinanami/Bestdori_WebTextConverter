// performance.js - 性能监控模块

export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      conversionTime: [],
      cacheHitRate: 0,
      memoryUsage: [],
      apiResponseTime: [],
    };

    this.startMonitoring();
  }

  startMonitoring() {
    // 监控内存使用
    if (performance.memory) {
      setInterval(() => {
        this.metrics.memoryUsage.push({
          timestamp: Date.now(),
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
        });

        // 只保留最近100个数据点
        if (this.metrics.memoryUsage.length > 100) {
          this.metrics.memoryUsage.shift();
        }
      }, 5000);
    }
  }

  // 测量函数执行时间
  measureTime(fn, label) {
    return async (...args) => {
      const start = performance.now();
      try {
        const result = await fn(...args);
        const duration = performance.now() - start;

        this.recordMetric(label, duration);
        console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);

        return result;
      } catch (error) {
        const duration = performance.now() - start;
        this.recordMetric(label, duration);
        throw error;
      }
    };
  }

  recordMetric(label, value) {
    if (!this.metrics[label]) {
      this.metrics[label] = [];
    }

    this.metrics[label].push({
      timestamp: Date.now(),
      value: value,
    });

    // 保留最近100个记录
    if (this.metrics[label].length > 100) {
      this.metrics[label].shift();
    }
  }

  getReport() {
    const report = {};

    Object.keys(this.metrics).forEach((key) => {
      const data = this.metrics[key];
      if (Array.isArray(data) && data.length > 0) {
        const values = data.map((d) => d.value || 0);
        report[key] = {
          average: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length,
        };
      }
    });

    return report;
  }

  // 导出性能数据
  exportData() {
    const data = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      report: this.getReport(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// 创建全局性能监控实例
export const perfMonitor = new PerformanceMonitor();
