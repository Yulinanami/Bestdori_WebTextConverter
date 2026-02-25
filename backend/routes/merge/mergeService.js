// 合并业务：按模式校验并执行多文件合并
const { mergeBestdori, mergeProject } = require("../../merger");

// 校验文件列表并执行文件合并。
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

  const isProject = !!firstData.version;
  // 要求同批文件类型一致：全部 project 或全部 bestdori。
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

  // 用首个文件推导模式，前端无需再传 mode。
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
