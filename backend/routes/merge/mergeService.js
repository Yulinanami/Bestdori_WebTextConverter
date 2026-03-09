// 处理文件合并
const { mergeBestdori, mergeProject } = require("../../merger");

// 合并文件列表
function mergeFiles(files, logger) {
  if (!Array.isArray(files) || files.length < 1) {
    const error = new Error("请至少提供一个文件");
    error.status = 400;
    throw error;
  }

  const firstData = files[0]?.data;
  if (!firstData || !Array.isArray(firstData.actions)) {
    const error = new Error("文件格式不正确，缺少 actions 数组");
    error.status = 400;
    throw error;
  }

  // 先用第一个文件锁定模式 后面的文件必须跟它同类
  const isProject = !!firstData.version;
  const allSameType = files.every((fileEntry) => {
    const fileData = fileEntry?.data;
    return (
      fileData &&
      Array.isArray(fileData.actions) &&
      !!fileData.version === isProject
    );
  });
  if (!allSameType) {
    const error = new Error(
      "合并取消：每个文件必须是同类文件（要么全是转换结果文件，要么全是进度文件）。",
    );
    error.status = 400;
    throw error;
  }

  // 同类检查通过后再决定走哪套合并逻辑
  const mode = isProject ? "project" : "bestdori";
  logger.info(`开始合并文件 - 模式: ${mode}, 文件数量: ${files.length}`);
  const result =
    mode === "bestdori" ? mergeBestdori(files) : mergeProject(files);
  logger.info(`文件合并成功 - 合并后 actions 数量: ${result.actions.length}`);
  return { result, mode };
}

module.exports = {
  mergeFiles,
};
