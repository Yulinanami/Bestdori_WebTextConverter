// 配置接口：返回前端初始化需要的配置数据
const express = require("express");
const multer = require("multer");
const { createLogger } = require("../logger");
const { configFromText, buildConfigExport } = require("./config/configIO");

const logger = createLogger("src.routes.config");

function createConfigRouter({ configManager }) {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage() });

  // 获取全部基础配置
  router.get("/config", (_req, res) => {
    try {
      logger.info("收到配置加载请求");
      res.json({
        character_mapping: configManager.config.character_mapping || {},
        parsing_config: configManager.config.parsing || {},
        quotes_config: configManager.config.quotes || {},
        character_motions: configManager.config.character_motions || {},
        character_expressions: configManager.config.character_expressions || {},
        avatar_mapping: configManager.config.avatar_mapping || {},
        patterns: configManager.config.patterns || {},
        quick_fill_options: configManager.config.quick_fill_options || [],
      });
      logger.info("配置加载成功");
    } catch (error) {
      logger.error("获取配置失败:", error);
      res.status(500).json({ error: `获取配置失败: ${error.message}` });
    }
  });

  // 获取服装配置（可用服装 + 默认服装）
  router.get("/costumes", (_req, res) => {
    try {
      logger.info("收到服装配置加载请求");
      res.json({
        available_costumes: configManager.config.costume_mapping || {},
        default_costumes: configManager.config.default_costumes || {},
      });
      logger.info("服装配置加载成功");
    } catch (error) {
      logger.error("获取服装配置失败:", error);
      res.status(500).json({ error: `获取服装配置失败: ${error.message}` });
    }
  });

  // 处理导入配置文件结构
  router.post("/config-import", upload.single("file"), (req, res) => {
    try {
      logger.info("收到导入配置请求");
      const text = req.file
        ? req.file.buffer.toString("utf8")
        : String(req.body.text || "");
      const config = configFromText(text);
      res.json({ config });
    } catch (error) {
      logger.warning(`导入配置失败: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });

  // 处理导出配置文件结构
  router.post("/config-export", (req, res) => {
    try {
      logger.info("收到导出配置请求");
      const result = buildConfigExport(req.body);
      res.json(result);
    } catch (error) {
      logger.warning(`导出配置失败: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { createConfigRouter };
