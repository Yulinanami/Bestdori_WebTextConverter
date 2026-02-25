// 上传文件相关处理

const SUPPORTED_UPLOAD_EXTENSIONS = [".txt", ".docx", ".md"];

// 尝试修复 multipart 文件名的 latin1/utf8 错码。
function decodeMultipartFilename(rawFilename) {
  if (!rawFilename) {
    return "";
  }
  const decoded = Buffer.from(rawFilename, "latin1").toString("utf8");
  return decoded.includes("\uFFFD") ? rawFilename : decoded;
}

// 判断上传文件扩展名是否在支持列表内。
function isSupportedUploadFilename(filename) {
  const lower = filename.toLowerCase();
  return SUPPORTED_UPLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// 统一文件大小显示格式（B/KB/MB）。
function formatFileSize(byteLength) {
  if (!Number.isFinite(byteLength) || byteLength < 0) {
    return "0 B";
  }
  if (byteLength < 1024) {
    return `${byteLength} B`;
  }
  if (byteLength < 1024 * 1024) {
    return `${(byteLength / 1024).toFixed(2)} KB`;
  }
  return `${(byteLength / (1024 * 1024)).toFixed(2)} MB`;
}

module.exports = {
  decodeMultipartFilename,
  isSupportedUploadFilename,
  formatFileSize,
};
