// 转换对话动作
const { toInt, toNumber } = require("./valueParsers");
const { removeWrappedQuotes } = require("./quoteTools");

// 转换一条对话动作
function convertTalkAction(options) {
  const {
    talkAction,
    activeQuotePairs,
    narratorName,
    appendSpaces,
    padBeforeNewline,
    mapOutputId,
    logger,
  } = options;

  const speakers = Array.isArray(talkAction?.speakers)
    ? talkAction.speakers
    : [];
  // 先把说话人 id 清洗成数字 供后面的输出和日志复用
  const characterIds = speakers
    .map((speaker) => {
      if (speaker?.characterId === undefined || speaker?.characterId === null) {
        return null;
      }
      return toInt(speaker.characterId, null);
    })
    .filter((id) => id !== null);
  const names = speakers.map((speaker) => speaker?.name ?? "");
  const originalText =
    typeof talkAction?.text === "string"
      ? talkAction.text
      : String(talkAction?.text ?? "");

  // 先去掉外层引号 再补换行前空格和结尾空格
  let processedBody = removeWrappedQuotes(originalText, activeQuotePairs);

  if (padBeforeNewline > 0 && processedBody) {
    const spacesToAdd = " ".repeat(padBeforeNewline);
    processedBody = processedBody.replace(/\n/g, `${spacesToAdd}\n`);
  }

  if (appendSpaces > 0) {
    processedBody += " ".repeat(appendSpaces);
  }

  const motions = [];
  if (Array.isArray(talkAction?.motions) && talkAction.motions.length > 0) {
    // 只保留带动作或表情的项 空分配不写进结果
    for (const motionData of talkAction.motions) {
      const motion = motionData?.motion ?? "";
      const expression = motionData?.expression ?? "";
      if (motion || expression) {
        const charId = toInt(motionData?.character, 0);
        motions.push({
          character: mapOutputId(charId),
          motion,
          expression,
          delay: toNumber(motionData?.delay, 0),
        });
      }
    }
  }

  const actionName = speakers.length > 0 ? names.join(" & ") : narratorName;

  // 先记主对话 再把附带动作表情逐条打到日志里
  if (speakers.length > 0) {
    logger.info(
      `对话动作 - 说话人: ${actionName} (ID: [${characterIds.join(", ")}]), 内容: ${processedBody}`,
    );
  } else {
    logger.info(`对话动作 - 旁白: ${processedBody}`);
  }
  if (motions.length > 0) {
    for (const motionEntry of motions) {
      logger.info(
        `  角色 ${motionEntry.character} - 动作: ${motionEntry.motion || "无"}, 表情: ${motionEntry.expression || "无"}, 延迟: ${motionEntry.delay}秒`,
      );
    }
  }

  return {
    type: "talk",
    delay: 0,
    wait: true,
    characters: characterIds.map((id) => mapOutputId(id)),
    name: actionName,
    body: processedBody,
    motions,
    voices: [],
    close: false,
  };
}

module.exports = {
  convertTalkAction,
};
