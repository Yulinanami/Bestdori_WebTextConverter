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
    appendSpacesBeforeNewline,
    mapOutputId,
    logger,
  } = options;

  const speakers = Array.isArray(talkAction?.speakers)
    ? talkAction.speakers
    : [];
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

  let processedBody = removeWrappedQuotes(originalText, activeQuotePairs);

  if (appendSpacesBeforeNewline > 0 && processedBody) {
    const spacesToAdd = " ".repeat(appendSpacesBeforeNewline);
    processedBody = processedBody.replace(/\n/g, `${spacesToAdd}\n`);
  }

  if (appendSpaces > 0) {
    processedBody += " ".repeat(appendSpaces);
  }

  const motions = [];
  if (Array.isArray(talkAction?.motions) && talkAction.motions.length > 0) {
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
