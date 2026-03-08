// 处理系统接口
const express = require("express");
const { createLogger } = require("../logger");

const logger = createLogger("src.app");

// 创建系统路由
function createSystemRouter({ onShutdown }) {
  const router = express.Router();

  // 关闭服务
  router.post("/shutdown", (_req, res) => {
    logger.info("收到关闭服务器的请求...");
    res.json({ message: "服务器正在关闭..." });
    if (typeof onShutdown === "function") {
      onShutdown();
    }
  });

  return router;
}

module.exports = { createSystemRouter };
