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

  const quotePairs = Object.entries(activeQuotePairs).sort(
    ([openingA], [openingB]) => openingB.length - openingA.length,
  );
  // 只有开头和结尾刚好配成完整一对时 才去掉外层引号
  for (const [opening, closing] of quotePairs) {
    if (
      opening &&
      closing &&
      stripped.length >= opening.length + closing.length &&
      stripped.startsWith(opening) &&
      stripped.endsWith(closing)
    ) {
      return stripped
        .slice(opening.length, stripped.length - closing.length)
        .trim();
    }
  }

  return text;
}

module.exports = {
  buildActiveQuotePairs,
  removeWrappedQuotes,
};
