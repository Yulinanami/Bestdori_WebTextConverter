// 合并文件上传解析
const { decodeMultipartFilename } = require("../conversion/uploadHelpers");

// 生成统一的 400 错误对象，供路由层直接返回给前端。
function buildBadRequestError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

// 解析一个上传的合并文件：修正文件名、校验 JSON、校验 actions 结构。
function parseMergeUpload(file) {
  if (!file) {
    throw buildBadRequestError("没有文件被上传");
  }

  const filename = decodeMultipartFilename(file.originalname || "");
  if (!filename) {
    throw buildBadRequestError("没有选择文件");
  }

  if (!filename.toLowerCase().endsWith(".json")) {
    throw buildBadRequestError(`文件 ${filename} 不是 JSON 格式。`);
  }

  let data;
  try {
    data = JSON.parse(file.buffer.toString("utf8"));
  } catch (error) {
    throw buildBadRequestError(`解析 ${filename} 失败: ${error.message}`);
  }

  if (!Array.isArray(data.actions)) {
    throw buildBadRequestError(
      `文件 ${filename} 格式不正确，缺少 actions 数组。`,
    );
  }

  return {
    name: filename,
    data,
  };
}

module.exports = {
  parseMergeUpload,
};
