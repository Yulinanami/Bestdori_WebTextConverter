// 合并接口：合并 Bestdori 结果文件或项目进度文件
const express = require("express");
const { mergeBestdori, mergeProject } = require("../merger");
const { createLogger } = require("../logger");

const logger = createLogger("src.routes.merger");

function orderedJsonResponse(res, data, status = 200) {
  // 保持键顺序输出 JSON（不使用 res.json）
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(data, null, 2));
}

function createMergeRouter() {
  const router = express.Router();

  // /api/merge：按模式合并文件列表
  router.post("/merge", (req, res) => {
    try {
      const data = req.body || {};
      const mode = data.mode;
      const files = data.files;

      if (!Array.isArray(files) || files.length < 1) {
        logger.warning("合并失败：未提供文件");
        orderedJsonResponse(res, { error: "请至少提供一个文件" }, 400);
        return;
      }

      if (mode !== "bestdori" && mode !== "project") {
        logger.warning(`合并失败：不支持的模式 ${mode}`);
        orderedJsonResponse(res, { error: `不支持的合并模式: ${mode}` }, 400);
        return;
      }

      for (const fileEntry of files) {
        const fileData = fileEntry?.data;
        if (!fileData || !Array.isArray(fileData.actions)) {
          const fileName = fileEntry?.name || "未知文件";
          logger.warning(`合并失败：文件 ${fileName} 缺少 actions 数组`);
          orderedJsonResponse(
            res,
            { error: `文件 ${fileName} 格式不正确，缺少 actions 数组` },
            400,
          );
          return;
        }
      }

      logger.info(`开始合并文件 - 模式: ${mode}, 文件数量: ${files.length}`);
      const result = mode === "bestdori" ? mergeBestdori(files) : mergeProject(files);
      logger.info(`文件合并成功 - 合并后 actions 数量: ${result.actions.length}`);
      orderedJsonResponse(res, { result });
    } catch (error) {
      logger.error("文件合并失败:", error);
      orderedJsonResponse(res, { error: `文件合并失败: ${error.message}` }, 500);
    }
  });

  return router;
}

module.exports = { createMergeRouter };
