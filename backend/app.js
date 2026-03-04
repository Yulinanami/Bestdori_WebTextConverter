// 应用装配：注册中间件、静态资源、API 路由与错误处理
const path = require("path");
const express = require("express");
const multer = require("multer");
const { createLogger } = require("./logger");
const { createConfigRouter } = require("./routes/configRoutes");
const { createConversionRouter } = require("./routes/conversionRoutes");
const { createMergeRouter } = require("./routes/mergeRoutes");
const { createSystemRouter } = require("./routes/systemRoutes");

const logger = createLogger("src.app");

function createApp({
  projectRoot,
  configManager,
  maxContentLength,
  onShutdown,
  enableShutdown,
}) {
  // 创建并配置 Express 应用实例
  const app = express();
  const templatePath = path.join(projectRoot, "templates", "index.html");
  const staticDir = path.join(projectRoot, "static");

  app.use(express.json({ limit: `${maxContentLength}b` }));
  app.use(
    express.urlencoded({ extended: false, limit: `${maxContentLength}b` }),
  );

  // 请求日志：记录请求与响应状态。
  app.use((req, res, next) => {
    logger.debug(`收到请求: ${req.method} ${req.path}`);
    const contentType = req.headers["content-type"] || "";
    if (
      req.method === "POST" &&
      contentType.includes("application/json") &&
      req.body &&
      Object.keys(req.body).length > 0
    ) {
      logger.debug("请求数据:", req.body);
    }
    res.on("finish", () => {
      logger.debug(`响应状态: ${res.statusCode} - ${req.method} ${req.path}`);
    });
    next();
  });

  app.use("/static", express.static(staticDir));

  // 首页：返回前端页面
  app.get("/", (_req, res) => {
    res.sendFile(templatePath);
  });

  // 注册所有 API 路由
  app.use("/api", createConfigRouter({ configManager }));
  app.use("/api", createConversionRouter({ configManager, maxContentLength }));
  app.use("/api", createMergeRouter());
  app.use("/api", createSystemRouter({ onShutdown, enableShutdown }));

  // 统一处理上传大小超限等 Multer 错误。
  app.use((error, _req, res, next) => {
    if (!(error instanceof multer.MulterError)) {
      next(error);
      return;
    }
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "文件处理失败: 文件大小超过16MB限制" });
      return;
    }
    res.status(400).json({ error: `文件处理失败: ${error.message}` });
  });

  // 统一处理未捕获异常。
  app.use((error, _req, res, next) => {
    logger.error("未处理异常:", error);
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(500).json({ error: `服务器错误: ${error.message}` });
  });

  return app;
}

module.exports = { createApp };
