// 处理引号

// 把引号配置转成映射
function buildActiveQuotePairs(quoteConfig) {
  const activeQuotePairs = {};
  if (Array.isArray(quoteConfig)) {
    // 只收成对的开闭引号 其它数据跳过
    for (const pair of quoteConfig) {
      if (Array.isArray(pair) && pair.length >= 2) {
        activeQuotePairs[pair[0]] = pair[1];
      }
    }
  }
  return activeQuotePairs;
}

// 去掉外层引号
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
  // 只有开头和结尾刚好配成一对时 才去掉外层引号
  if (expectedClosing && stripped.endsWith(expectedClosing)) {
    return stripped.slice(1, -1).trim();
  }

  return text;
}

module.exports = {
  buildActiveQuotePairs,
  removeWrappedQuotes,
};
