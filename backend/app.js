// 创建后端应用
const path = require("path");
const express = require("express");
const multer = require("multer");
const { createLogger } = require("./logger");
const { createConfigRouter } = require("./routes/configRoutes");
const { createRouter } = require("./routes/conversionRoutes");
const { createMergeRouter } = require("./routes/mergeRoutes");

const logger = createLogger("src.app");

// 创建并配置后端应用
function createApp({ projectRoot, configManager, maxContentLength }) {
  // 创建并配置 Express 应用实例
  const app = express();
  const templatePath = path.join(projectRoot, "templates", "index.html");
  const staticDir = path.join(projectRoot, "static");

  app.use(express.json({ limit: `${maxContentLength}b` }));
  app.use(
    express.urlencoded({ extended: false, limit: `${maxContentLength}b` }),
  );

  // 记录请求日志
  app.use((req, res, next) => {
    logger.debug(`收到请求: ${req.method} ${req.path}`);
    const contentType = req.headers["content-type"] || "";
    // 只打印有内容的 JSON 请求 避免把上传和空请求刷满日志
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

  // 返回首页
  app.get("/", (_req, res) => {
    res.sendFile(templatePath);
  });

  // 注册路由
  app.use("/api", createConfigRouter({ configManager }));
  app.use("/api", createRouter({ configManager, maxContentLength }));
  app.use("/api", createMergeRouter());

  // 处理上传报错
  app.use((error, _req, res, next) => {
    // 不是 multer 的错误继续交给后面的总错误处理中间件
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

  // 处理未捕获的错误
  app.use((error, _req, res, next) => {
    logger.error("未处理异常:", error);
    // 响应已经发出时只能继续往后传错误
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(500).json({ error: `服务器错误: ${error.message}` });
  });

  return app;
}

module.exports = { createApp };
