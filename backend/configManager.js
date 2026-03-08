// 读取配置文件
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { createLogger } = require("./logger");

const logger = createLogger("src.config");

class ConfigManager {
  // 保存配置路径并读取配置
  constructor(configPath = "config.yaml") {
    this.configPath = path.isAbsolute(configPath)
      ? configPath
      : path.join(path.resolve(__dirname, ".."), configPath);
    this.config = this.loadConfig();
    logger.info(`ConfigManager using config file: ${this.configPath}`);
  }

  // 读取配置内容
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
}

module.exports = { ConfigManager };
