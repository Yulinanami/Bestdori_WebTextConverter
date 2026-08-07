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

// 同时提供 ASCII 回退名和 UTF-8 文件名
function buildContentDisposition(filename) {
  const fallback = filename.replace(/[^\x20-\x7E]/g, "_");
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

module.exports = {
  sanitizeFilename,
  buildDownloadFilename,
  buildContentDisposition,
};
