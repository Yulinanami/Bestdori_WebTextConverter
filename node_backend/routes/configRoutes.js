// 配置接口：返回前端初始化需要的配置数据
const express = require("express");
const { createLogger } = require("../logger");

const logger = createLogger("src.routes.config");

function createConfigRouter({ configManager }) {
  const router = express.Router();

  // 获取全部基础配置
  router.get("/config", (req, res) => {
    try {
      logger.info("收到配置加载请求");
      res.json({
        character_mapping: configManager.getCharacterMapping(),
        parsing_config: configManager.getParsingConfig(),
        quotes_config: configManager.getQuotesConfig(),
        character_motions: configManager.getCharacterMotions(),
        character_expressions: configManager.getCharacterExpressions(),
        avatar_mapping: configManager.getAvatarMapping(),
        patterns: configManager.getPatterns(),
        quick_fill_options: configManager.config.quick_fill_options || [],
      });
      logger.info("配置加载成功");
    } catch (error) {
      logger.error("获取配置失败:", error);
      res.status(500).json({ error: `获取配置失败: ${error.message}` });
    }
  });

  // 获取服装配置（可用服装 + 默认服装）
  router.get("/costumes", (req, res) => {
    try {
      logger.info("收到服装配置加载请求");
      res.json({
        available_costumes: configManager.getAvailableCostumes(),
        default_costumes: configManager.getCostumeMapping(),
      });
      logger.info("服装配置加载成功");
    } catch (error) {
      logger.error("获取服装配置失败:", error);
      res.status(500).json({ error: `获取服装配置失败: ${error.message}` });
    }
  });

  return router;
}

module.exports = { createConfigRouter };
