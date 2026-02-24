// 项目转换器：把前端项目 JSON 转成 Bestdori 目标 JSON
const { createLogger } = require("./logger");

const logger = createLogger("src.converter");

class QuoteHandler {
  // 若文本被成对引号包裹，则移除两端引号
  removeQuotes(text, activeQuotePairs) {
    const stripped = text.trim();
    if (stripped.length < 2 || !activeQuotePairs || !Object.keys(activeQuotePairs).length) {
      return text;
    }

    const firstChar = stripped[0];
    const expectedClosing = activeQuotePairs[firstChar];
    if (expectedClosing && stripped.endsWith(expectedClosing)) {
      return stripped.slice(1, -1).trim();
    }

    return text;
  }
}

const toInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

class ProjectConverter {
  // 初始化转换器（处理头像映射与引号清理）
  constructor(avatarMapping = {}) {
    this.quoteHandler = new QuoteHandler();
    this.avatarMapping = avatarMapping || {};
  }

  getOutputId(charId) {
    const mapped = this.avatarMapping[charId] ?? this.avatarMapping[String(charId)];
    return mapped ?? charId;
  }

  getOutputIds(charIds) {
    return charIds.map((id) => this.getOutputId(id));
  }

  convert(
    projectFile,
    quoteConfig = null,
    narratorName = " ",
    appendSpaces = 0,
    appendSpacesBeforeNewline = 0,
  ) {
    // 主入口：转换整个项目文件
    logger.info(
      `开始转换项目 - 旁白名称: '${narratorName}', 结尾空格: ${appendSpaces}, 换行前补空格: ${appendSpacesBeforeNewline}`,
    );

    const activeQuotePairs = {};
    if (Array.isArray(quoteConfig)) {
      for (const pair of quoteConfig) {
        if (Array.isArray(pair) && pair.length >= 2) {
          activeQuotePairs[pair[0]] = pair[1];
        }
      }
    }

    const actions = this.translateActions(
      Array.isArray(projectFile.actions) ? projectFile.actions : [],
      activeQuotePairs,
      narratorName,
      appendSpaces,
      appendSpacesBeforeNewline,
    );
    const globalSettings = projectFile.globalSettings || {};

    const talkActions = actions.filter((action) => action.type === "talk");
    const layoutActions = actions.filter((action) => action.type === "layout");
    const uniqueCharacters = new Set();
    for (const action of actions) {
      if (Array.isArray(action.characters)) {
        for (const cid of action.characters) {
          uniqueCharacters.add(cid);
        }
      }
      if (action.character !== undefined && action.character !== null) {
        uniqueCharacters.add(action.character);
      }
    }

    logger.info(
      `转换统计 - 对话动作: ${talkActions.length}, 布局动作: ${layoutActions.length}, 涉及角色数: ${uniqueCharacters.size}`,
    );
    logger.info(
      `全局设置 - 服务器: ${globalSettings.server ?? 0}, 背景: ${globalSettings.background ?? "N/A"}, BGM: ${globalSettings.bgm ?? "N/A"}`,
    );

    const result = {
      server: globalSettings.server ?? 0,
      voice: globalSettings.voice ?? "",
      background: globalSettings.background ?? null,
      bgm: globalSettings.bgm ?? null,
      actions,
    };

    const output = JSON.stringify(result, null, 2);
    logger.info(`项目转换成功 - 生成JSON长度: ${output.length} 字符`);
    return output;
  }

  translateActions(
    projectActions,
    activeQuotePairs,
    narratorName,
    appendSpaces,
    appendSpacesBeforeNewline,
  ) {
    // 遍历项目动作并分别转换 talk/layout
    const translatedActions = [];
    for (const action of projectActions) {
      const actionType = action?.type;
      if (actionType === "talk") {
        translatedActions.push(
          this.translateTalkAction(
            action,
            activeQuotePairs,
            narratorName,
            appendSpaces,
            appendSpacesBeforeNewline,
          ),
        );
      } else if (actionType === "layout") {
        translatedActions.push(this.translateLayoutAction(action));
      }
    }
    return translatedActions;
  }

  translateTalkAction(
    talkAction,
    activeQuotePairs,
    narratorName,
    appendSpaces,
    appendSpacesBeforeNewline,
  ) {
    // 转换对话动作
    const speakers = Array.isArray(talkAction?.speakers) ? talkAction.speakers : [];
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

    let processedBody = this.quoteHandler.removeQuotes(originalText, activeQuotePairs);

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
            character: this.getOutputId(charId),
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
      characters: this.getOutputIds(characterIds),
      name: actionName,
      body: processedBody,
      motions,
      voices: [],
      close: false,
    };
  }

  translateLayoutAction(layoutAction) {
    // 转换布局动作
    const position = layoutAction?.position || {};
    const initialState = layoutAction?.initialState || {};
    const charId = toInt(layoutAction?.characterId, 0);
    const fromPos = position.from || {};
    const toPos = position.to || {};

    const layoutType = layoutAction?.layoutType ?? "appear";
    const costume = layoutAction?.costume ?? "";
    const motion = initialState.motion ?? "";
    const expression = initialState.expression ?? "";
    const delay = toNumber(layoutAction?.delay, 0);
    const sideFrom = fromPos.side ?? "center";
    const sideTo = toPos.side ?? "center";
    const offsetFrom = toInt(fromPos.offsetX, 0);
    const offsetTo = toInt(toPos.offsetX, 0);

    logger.info(
      `布局动作 - 类型: ${layoutType}, 角色ID: ${charId}, 服装: ${costume || "默认"}, 延迟: ${delay}秒`,
    );
    logger.info(`  位置: ${sideFrom}(${offsetFrom >= 0 ? "+" : ""}${offsetFrom}) -> ${sideTo}(${offsetTo >= 0 ? "+" : ""}${offsetTo})`);
    logger.info(`  初始状态 - 动作: ${motion || "无"}, 表情: ${expression || "无"}`);

    return {
      type: "layout",
      delay,
      wait: true,
      layoutType,
      character: this.getOutputId(charId),
      costume,
      motion,
      expression,
      sideFrom,
      sideFromOffsetX: offsetFrom,
      sideTo,
      sideToOffsetX: offsetTo,
    };
  }
}

module.exports = { ProjectConverter };
