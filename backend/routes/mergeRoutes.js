// 处理合并接口
const express = require("express");
const multer = require("multer");
const { createLogger } = require("../logger");
const { mergeFiles } = require("./merge/mergeService");
const { parseMergeUpload } = require("./merge/mergeFileHelpers");
const { formatFileSize } = require("./conversion/uploadHelpers");

const logger = createLogger("src.routes.merger");

// 创建合并路由
function createMergeRouter() {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage() });

  // 导入合并文件
  router.post("/merge-file-import", upload.single("file"), (req, res) => {
    try {
      const file = parseMergeUpload(req.file);
      logger.info(
        `正在导入合并文件: ${file.name} (大小: ${formatFileSize(req.file.buffer.length)})`,
      );
      res.json({ file });
    } catch (error) {
      if (error?.status === 400) {
        logger.warning(`导入合并文件失败: ${error.message}`);
        res.status(400).json({ error: error.message });
        return;
      }
      logger.error("导入合并文件失败:", error);
      res.status(500).json({ error: `导入合并文件失败: ${error.message}` });
    }
  });

  // 合并文件
  router.post("/merge", (req, res) => {
    try {
      const data = req.body || {};
      const files = data.files;
      const result = mergeFiles(files, logger);
      res.json(result);
    } catch (error) {
      if (error?.status === 400) {
        logger.warning(`文件合并失败: ${error.message}`);
        res.status(400).json({ error: error.message });
      } else {
        logger.error("文件合并失败:", error);
        res.status(500).json({ error: `文件合并失败: ${error.message}` });
      }
    }
  });

  return router;
}

module.exports = { createMergeRouter };
