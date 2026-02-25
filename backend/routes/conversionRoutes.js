// 转换接口：项目转换、文件上传、下载、文本分段
const express = require("express");
const multer = require("multer");
const path = require("path");
const { ProjectConverter } = require("../projectConverter");
const { FileFormatConverter } = require("../fileFormatConverter");
const { createLogger } = require("../logger");

const logger = createLogger("src.routes.conversion");

function decodeMultipartFilename(rawFilename) {
  // 修复 multipart 中常见的 latin1/utf8 文件名错码
  if (!rawFilename) {
    return "";
  }
  const decoded = Buffer.from(rawFilename, "latin1").toString("utf8");
  return decoded.includes("\uFFFD") ? rawFilename : decoded;
}

function sanitizeFilename(name) {
  // 下载文件名安全化
  const normalized = path.basename(String(name || "result.json"));
  const safe = normalized.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
  if (!safe.trim()) {
    return "result.json";
  }
  return safe.endsWith(".json") ? safe : `${safe}.json`;
}

function createConversionRouter({ configManager, maxContentLength }) {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxContentLength },
  });

  // /api/convert：接收项目文件并返回结果 JSON 字符串
  router.post("/convert", (req, res) => {
    try {
      logger.info("收到项目转换请求");
      const data = req.body || {};
      const projectFile = data.projectFile;
      const quoteConfig = data.quoteConfig;
      const parsingConfig = configManager.getParsingConfig();
      const defaultNarrator = parsingConfig.default_narrator_name ?? " ";
      const narratorName = data.narratorName || defaultNarrator;
      const appendSpaces = Number(data.appendSpaces) || 0;
      const appendSpacesBeforeNewline =
        Number(data.appendSpacesBeforeNewline) || 0;

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

      const converter = new ProjectConverter(configManager.getAvatarMapping());
      const result = converter.convert(
        projectFile,
        quoteConfig,
        narratorName,
        appendSpaces,
        appendSpacesBeforeNewline,
      );
      res.json({ result });
    } catch (error) {
      logger.error("项目文件转换失败:", error);
      res.status(500).json({ error: `转换失败: ${error.message}` });
    }
  });

  // /api/upload：接收文件并解析为纯文本
  router.post("/upload", upload.single("file"), async (req, res) => {
    try {
      logger.info("收到文件上传请求");
      if (!req.file) {
        logger.warning("request 中没有 file 字段");
        res.status(400).json({ error: "没有文件被上传" });
        return;
      }

      const filename = decodeMultipartFilename(req.file.originalname || "");
      if (!filename) {
        logger.warning("文件名为空");
        res.status(400).json({ error: "没有选择文件" });
        return;
      }

      const fileSizeKb = req.file.buffer.length / 1024;
      logger.info(`正在处理文件: ${filename} (${fileSizeKb.toFixed(2)} KB)`);
      const content = await FileFormatConverter.readFileContentToText(
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

  // /api/download：将传入内容作为 JSON 附件下载
  router.post("/download", (req, res) => {
    try {
      logger.info("收到文件下载请求");
      const data = req.body || {};
      const content =
        typeof data.content === "string"
          ? data.content
          : String(data.content ?? "");
      const filename = sanitizeFilename(data.filename || "result.json");

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

  // /api/segment-text：按空行切分段落
  router.post("/segment-text", (req, res) => {
    try {
      logger.info("收到文本分段请求");
      const data = req.body || {};
      const rawText = typeof data.text === "string" ? data.text : "";
      logger.info(`正在分段文本 (长度: ${rawText.length} 字符)`);

      const lines = rawText.split(/\r?\n/);
      const segments = [];
      let currentSegment = [];

      for (const line of lines) {
        const stripped = line.trim();
        if (stripped) {
          currentSegment.push(stripped);
        } else if (currentSegment.length > 0) {
          segments.push(currentSegment.join("\n"));
          currentSegment = [];
        }
      }
      if (currentSegment.length > 0) {
        segments.push(currentSegment.join("\n"));
      }

      logger.info(`文本分段完成 - 生成 ${segments.length} 个段落`);
      res.json({ segments });
    } catch (error) {
      logger.error("文本分段失败:", error);
      res.status(500).json({ error: `文本分段失败: ${error.message}` });
    }
  });

  return router;
}

module.exports = { createConversionRouter };
