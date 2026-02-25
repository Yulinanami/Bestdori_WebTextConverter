// 转换统计

// 统计转换后动作数量与涉及角色数量。
function collectActionStats(actions) {
  let talkCount = 0;
  let layoutCount = 0;
  const uniqueCharacters = new Set();

  for (const action of actions) {
    if (action.type === "talk") {
      talkCount += 1;
    } else if (action.type === "layout") {
      layoutCount += 1;
    }

    if (Array.isArray(action.characters)) {
      for (const cid of action.characters) {
        uniqueCharacters.add(cid);
      }
    }
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
