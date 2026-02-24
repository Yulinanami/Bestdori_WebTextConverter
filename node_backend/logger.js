// 统一日志工具：输出固定日志格式
// YYYY-MM-DD HH:MM:SS - [LEVEL] - module - message
const LEVEL_WEIGHT = {
  DEBUG: 10,
  INFO: 20,
  WARNING: 30,
  ERROR: 40,
};

// 默认显示 INFO 及以上，DEBUG 用于请求细节。
const CURRENT_LEVEL = "INFO";

function pad2(num) {
  return String(num).padStart(2, "0");
}

function formatNow() {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function shouldLog(level) {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[CURRENT_LEVEL];
}

function stringifyArg(arg) {
  if (arg instanceof Error) {
    return arg.stack || arg.message;
  }
  if (typeof arg === "string") {
    return arg;
  }
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function createLogger(name) {
  // 按模块名创建 logger，便于定位日志来源
  function write(level, ...args) {
    if (!shouldLog(level)) {
      return;
    }
    const msg = args.map((arg) => stringifyArg(arg)).join(" ");
    const line = `${formatNow()} - [${level}] - ${name} - ${msg}`;
    if (level === "ERROR") {
      console.error(line);
    } else if (level === "WARNING") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  return {
    debug: (...args) => write("DEBUG", ...args),
    info: (...args) => write("INFO", ...args),
    warning: (...args) => write("WARNING", ...args),
    error: (...args) => write("ERROR", ...args),
  };
}

module.exports = { createLogger };
