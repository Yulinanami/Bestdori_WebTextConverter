// 统计动作数量

// 数动作和角色
function collectActionStats(actions) {
  let talkCount = 0;
  let layoutCount = 0;
  const uniqueCharacters = new Set();

  // 一次遍历同时统计动作数量和涉及角色
  for (const action of actions) {
    if (action.type === "talk") {
      talkCount += 1;
    } else if (action.type === "layout") {
      layoutCount += 1;
    }

    if (Array.isArray(action.characters)) {
      // 对话动作走 characters 数组
      for (const cid of action.characters) {
        uniqueCharacters.add(cid);
      }
    }
    // 布局动作走单个 character 字段
    if (action.character !== undefined && action.character !== null) {
      uniqueCharacters.add(action.character);
    }
  }

  return {
    talkCount,
    layoutCount,
    characterCount: uniqueCharacters.size,
  };
}

module.exports = {
  collectActionStats,
};
