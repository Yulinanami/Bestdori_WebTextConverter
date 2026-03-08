// 处理配置接口
const express = require("express");
const multer = require("multer");
const { createLogger } = require("../logger");
const { configFromText, buildConfigExport } = require("./config/configIO");

const logger = createLogger("src.routes.config");

// 创建配置路由
function createConfigRouter({ configManager }) {
  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage() });

  // 取基础配置
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

  // 取服装配置
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

  // 导入配置
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

  // 导出配置
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
