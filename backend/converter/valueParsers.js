// 数值解析工具

// 按整数解析，失败则返回 fallback。
function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

// 按数字解析，失败则返回 fallback。
function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  toInt,
  toNumber,
};
