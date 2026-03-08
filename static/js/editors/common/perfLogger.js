// 编辑器里的性能日志
const PERF_STYLES = {
  candidate: "color:#60a5fa;font-weight:600;",
  hit: "color:#22c55e;font-weight:700;",
  fail: "color:#f59e0b;font-weight:700;",
  fallback: "color:#ef4444;font-weight:700;",
  undoStart: "color:#a78bfa;font-weight:700;",
  undoHit: "color:#38bdf8;font-weight:700;",
  undoSkip: "color:#94a3b8;font-weight:600;",
  button: "color:#facc15;font-weight:700;",
  base: "color:#e2e8f0;",
};

// 默认打开性能日志
const PERF_LOG_ENABLED = true;

// 看现在要不要输出日志
function isPerfLogEnabled() {
  if (typeof window !== "undefined" && typeof window.__EDITOR_PERF_LOG__ === "boolean") {
    return window.__EDITOR_PERF_LOG__;
  }
  return PERF_LOG_ENABLED;
}

// 按日志内容选颜色
function resolvePerfStyle(message) {
  if (!message.includes("[PERF]")) {
    return "";
  }
  if (message.includes("[局部候选]")) {
    return PERF_STYLES.candidate;
  }
  if (message.includes("回退全量渲染")) {
    return PERF_STYLES.fallback;
  }
  if (message.includes("[局部短路] 失败")) {
    return PERF_STYLES.fail;
  }
  if (message.includes("[局部短路] 命中")) {
    return PERF_STYLES.hit;
  }
  if (message.includes("[撤销恢复] 开始")) {
    return PERF_STYLES.undoStart;
  }
  if (message.includes("[撤销恢复] 命中")) {
    return PERF_STYLES.undoHit;
  }
  if (message.includes("[撤销恢复] 跳过")) {
    return PERF_STYLES.undoSkip;
  }
  if (message.includes("[expressionButton]")) {
    return PERF_STYLES.button;
  }
  return PERF_STYLES.base;
}

// 打印性能日志
export function perfLog(message) {
  if (typeof message !== "string") {
    if (!isPerfLogEnabled()) return;
    console.log(message);
    return;
  }
  const isDebugMessage =
    message.includes("[PERF]") || message.includes("[DEBUG]");
  if (isDebugMessage && !isPerfLogEnabled()) {
    return;
  }
  const style = resolvePerfStyle(message);
  if (!style) {
    console.log(message);
    return;
  }
  console.log(`%c${message}`, style);
}
