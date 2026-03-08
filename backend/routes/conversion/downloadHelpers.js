// 处理下载文件名
const path = require("path");

// 清理文件名
function sanitizeFilename(name) {
  const normalized = path.basename(String(name || "result.json"));
  const safe = normalized.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
  if (!safe.trim()) {
    return "result.json";
  }
  return safe.endsWith(".json") ? safe : `${safe}.json`;
}

// 生成默认文件名
function buildDownloadFilename() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
  return `result_${stamp}.json`;
}

module.exports = {
  sanitizeFilename,
  buildDownloadFilename,
};
