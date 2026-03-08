// 处理上传文件

const SUPPORTED_UPLOAD_EXTENSIONS = [".txt", ".docx", ".md"];

// 修正上传文件名
function decodeMultipartFilename(rawFilename) {
  if (!rawFilename) {
    return "";
  }
  const decoded = Buffer.from(rawFilename, "latin1").toString("utf8");
  return decoded.includes("\uFFFD") ? rawFilename : decoded;
}

// 判断后缀支不支持
function isSupportedUploadFilename(filename) {
  const lower = filename.toLowerCase();
  return SUPPORTED_UPLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// 格式化文件大小
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
