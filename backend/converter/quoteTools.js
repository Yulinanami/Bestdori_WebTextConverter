// 引号处理

// 将引号配置数组转换为 { 开引号: 闭引号 } 映射。
function buildActiveQuotePairs(quoteConfig) {
  const activeQuotePairs = {};
  if (Array.isArray(quoteConfig)) {
    for (const pair of quoteConfig) {
      if (Array.isArray(pair) && pair.length >= 2) {
        activeQuotePairs[pair[0]] = pair[1];
      }
    }
  }
  return activeQuotePairs;
}

// 若文本整体被成对引号包裹，则去掉外层引号。
function removeWrappedQuotes(text, activeQuotePairs) {
  const stripped = text.trim();
  if (
    stripped.length < 2 ||
    !activeQuotePairs ||
    !Object.keys(activeQuotePairs).length
  ) {
    return text;
  }

  const firstChar = stripped[0];
  const expectedClosing = activeQuotePairs[firstChar];
  if (expectedClosing && stripped.endsWith(expectedClosing)) {
    return stripped.slice(1, -1).trim();
  }

  return text;
}

module.exports = {
  buildActiveQuotePairs,
  removeWrappedQuotes,
};
