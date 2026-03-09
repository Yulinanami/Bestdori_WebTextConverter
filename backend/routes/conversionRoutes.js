// 处理转换相关接口
const express = require("express");
const multer = require("multer");
const { ProjectConverter } = require("../projectConverter");
const { FileFormatConverter } = require("../fileFormatConverter");
const { createLogger } = require("../logger");
const { decodeFilename, isUploadFile, formatFileSize } = require("./conversion/uploadHelpers");
const { sanitizeFilename, buildDownloadFilename } = require("./conversion/downloadHelpers");
const { isProjectFile, buildProjectExport } = require("./conversion/projectFileHelpers");

const logger = createLogger("src.routes.conversion");

// 创建转换路由
function createRouter({ configManager, maxContentLength }) {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxContentLength },
  });

  // 转换项目
  router.post("/convert", (req, res) => {
    try {
      logger.info("收到项目转换请求");
      const data = req.body || {};
      const projectFile = data.projectFile;
      const quoteConfig = data.quoteConfig;
      const parsingConfig = configManager.config.parsing || {};
      const defaultNarrator = parsingConfig.default_narrator_name ?? " ";
      const narratorName = data.narratorName || defaultNarrator;
      const appendSpaces = Number(data.appendSpaces) || 0;
      const padBeforeNewline =
        Number(data.appendSpacesBeforeNewline) || 0;

      // 只接受项目文件 旧版 text 字段会被拦下
      if (
        !projectFile ||
        typeof projectFile !== "object" ||
        Array.isArray(projectFile)
      ) {
        if (data.text !== undefined) {
          logger.warning("API不匹配，客户端使用旧版 text 字段");
          res.status(400).json({ error: "API不匹配，请刷新页面或清除缓存。" });
          return;
        }
        logger.warning("无效的项目文件");
        res.status(400).json({ error: "无效的项目文件" });
        return;
      }

      const converter = new ProjectConverter(
        configManager.config.avatar_mapping || {},
      );
      const result = converter.convert(
        projectFile,
        quoteConfig,
        narratorName,
        appendSpaces,
        padBeforeNewline,
      );
      res.json({ result });
    } catch (error) {
      logger.error("项目文件转换失败:", error);
      res.status(500).json({ error: `转换失败: ${error.message}` });
    }
  });

  // 上传文件
  router.post("/upload", upload.single("file"), async (req, res) => {
    try {
      logger.info("收到文件上传请求");
      if (!req.file) {
        logger.warning("request 中没有 file 字段");
        res.status(400).json({ error: "没有文件被上传" });
        return;
      }

      const filename = decodeFilename(req.file.originalname || "");
      if (!filename) {
        logger.warning("文件名为空");
        res.status(400).json({ error: "没有选择文件" });
        return;
      }

      // 先按文件名拦一遍 才能避免把不支持的文件喂给解析器
      if (!isUploadFile(filename)) {
        logger.warning(`不支持的文件类型: ${filename}`);
        res.status(400).json({ error: "只支持 .txt, .docx, .md 文件" });
        return;
      }

      logger.info(
        `正在处理文件: ${filename} (大小: ${formatFileSize(req.file.buffer.length)})`,
      );
      const content = await FileFormatConverter.readText(
        filename,
        req.file.buffer,
      );
      logger.info(`文件解析成功 - 内容长度: ${content.length} 字符`);
      res.json({ content });
    } catch (error) {
      logger.error("文件上传失败:", error);
      res.status(400).json({ error: `文件处理失败: ${error.message}` });
    }
  });

  // 下载结果
  router.post("/download", (req, res) => {
    try {
      logger.info("收到文件下载请求");
      const data = req.body || {};
      const content =
        typeof data.content === "string"
          ? data.content
          : String(data.content ?? "");
      const filenameInput = data.filename || buildDownloadFilename();
      const filename = sanitizeFilename(filenameInput);

      logger.info(`生成下载文件: ${filename} (大小: ${content.length} 字符)`);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.status(200).send(content);
      logger.info(`文件下载成功: ${filename}`);
    } catch (error) {
      logger.error("文件下载失败:", error);
      res.status(500).json({ error: `文件下载失败: ${error.message}` });
    }
  });

  // 导入项目进度
  router.post("/project-file-import", upload.single("file"), (req, res) => {
    let filename = "inline_text";
    try {
      logger.info("收到项目文件导入请求");
      filename = req.file
        ? decodeFilename(req.file.originalname || "")
        : "inline_text";
      if (req.file) {
        logger.info(
          `正在导入项目文件: ${filename} (大小: ${formatFileSize(req.file.buffer.length)})`,
        );
      }

      // 同时兼容上传文件和直接贴文本
      const text = req.file
        ? req.file.buffer.toString("utf8")
        : String(req.body.text || "");
      const projectFile = JSON.parse(text);
      if (!isProjectFile(projectFile)) {
        logger.warning(
          `导入项目文件失败: 文件 ${filename} 格式不符合编辑器进度，需导入“保存进度”导出的 JSON。`,
        );
        res.status(400).json({
          error: "文件格式不符合编辑器进度，需导入“保存进度”导出的 JSON。",
        });
        return;
      }
      logger.info(
        `项目文件导入成功: ${filename} - actions: ${projectFile.actions.length}`,
      );
      res.json({ projectFile });
    } catch (error) {
      logger.warning(`导入项目文件失败: ${error.message} (文件: ${filename})`);
      res.status(400).json({ error: `项目文件导入失败: ${error.message}` });
    }
  });

  // 导出项目进度
  router.post("/project-export", (req, res) => {
    try {
      logger.info("收到项目文件导出请求");
      const projectFile = req.body.projectFile;
      if (!isProjectFile(projectFile)) {
        logger.warning("导出项目文件失败: 无效的项目文件");
        res.status(400).json({ error: "无效的项目文件" });
        return;
      }
      const result = buildProjectExport(projectFile);
      res.json(result);
    } catch (error) {
      logger.warning(`导出项目文件失败: ${error.message}`);
      res.status(400).json({ error: `项目文件导出失败: ${error.message}` });
    }
  });

  return router;
}

module.exports = { createRouter };
