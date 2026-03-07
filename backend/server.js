// 服务启动入口：创建应用、监听端口、处理进程退出
const path = require("path");
const { spawn } = require("child_process");
const { ConfigManager } = require("./configManager");
const { createApp } = require("./app");
const { createLogger } = require("./logger");

const logger = createLogger("server");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number.parseInt(process.env.PORT || "5000", 10);
const MAX_CONTENT_LENGTH = 16 * 1024 * 1024;
const shouldOpenBrowser = process.env.OPEN_BROWSER === "1";

const projectRoot = path.resolve(__dirname, "..");
const configManager = new ConfigManager(path.join(projectRoot, "config.yaml"));

const app = createApp({
  projectRoot,
  configManager,
  maxContentLength: MAX_CONTENT_LENGTH,
});

// 启动后自动打开浏览器访问首页
function openBrowser(url) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
    }).unref();
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

const server = app.listen(PORT, HOST, () => {
  logger.info("=".repeat(60));
  logger.info("文本转JSON转换器服务器启动中...");
  logger.info(`监听地址: http://${HOST}:${PORT}`);
  logger.info(`本地访问: http://127.0.0.1:${PORT}`);
  logger.info("=".repeat(60));

  if (shouldOpenBrowser) {
    setTimeout(() => {
      try {
        logger.info(`正在打开浏览器: http://127.0.0.1:${PORT}`);
        openBrowser(`http://127.0.0.1:${PORT}`);
      } catch (error) {
        logger.warning(`自动打开浏览器失败: ${error.message}`);
      }
    }, 1000);
  }
});

server.on("error", (error) => {
  logger.error("服务器启动失败:", error);
  process.exit(1);
});

const shutdown = (signal) => {
  logger.info(`收到 ${signal}，正在关闭服务器...`);
  server.close(() => {
    logger.info("清理完成。");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
