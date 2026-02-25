// 系统接口：当前仅用于本地关闭服务
const express = require("express");
const { createLogger } = require("../logger");

const logger = createLogger("src.app");

function createSystemRouter({ onShutdown }) {
  const router = express.Router();

  // /api/shutdown：响应后触发服务退出
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
