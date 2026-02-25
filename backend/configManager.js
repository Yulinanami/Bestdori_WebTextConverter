// 配置管理器：读取 config.yaml 并提供便捷取值方法
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { createLogger } = require("./logger");

const logger = createLogger("src.config");

class ConfigManager {
  // 初始化：确定配置文件路径并加载到内存
  constructor(configPath = "config.yaml") {
    this.configPath = path.isAbsolute(configPath)
      ? configPath
      : path.join(path.resolve(__dirname, ".."), configPath);
    this.config = this.loadConfig();
    logger.info(`ConfigManager using config file: ${this.configPath}`);
  }

  loadConfig() {
    if (!fs.existsSync(this.configPath)) {
      logger.error(`配置文件不存在: ${this.configPath}。将使用空配置。`);
      return {};
    }

    try {
      logger.info(`正在加载配置文件: ${this.configPath}`);
      const content = fs.readFileSync(this.configPath, "utf8");
      const parsed = yaml.load(content) || {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        logger.error(
          `配置文件 ${this.configPath} 顶层不是有效对象。将使用空配置。`,
        );
        return {};
      }
      logger.info(
        `配置文件加载成功 - 包含 ${Object.keys(parsed).length} 个顶级配置项`,
      );
      return parsed;
    } catch (error) {
      logger.error(
        `加载配置文件时发生错误: ${error.message}。将使用空配置。`,
        error,
      );
      return {};
    }
  }

  getCharacterMapping() {
    // 角色名 -> 角色ID列表
    return this.config.character_mapping || {};
  }

  getParsingConfig() {
    // 解析相关配置（如默认旁白）
    return this.config.parsing || {};
  }

  getQuotesConfig() {
    // 引号配置
    return this.config.quotes || {};
  }

  getCostumeMapping() {
    // 角色ID -> 默认服装
    return this.config.default_costumes || {};
  }

  getAvailableCostumes() {
    // 角色ID -> 可用服装列表
    return this.config.costume_mapping || {};
  }

  getCharacterMotions() {
    // 角色ID -> 动作列表
    return this.config.character_motions || {};
  }

  getCharacterExpressions() {
    // 角色ID -> 表情列表
    return this.config.character_expressions || {};
  }

  getAvatarMapping() {
    // 特殊角色ID -> 头像ID
    return this.config.avatar_mapping || {};
  }

  getPatterns() {
    // 正则配置
    return this.config.patterns || {};
  }
}

module.exports = { ConfigManager };
