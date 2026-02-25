// 项目转换器：把前端项目 JSON 转成 Bestdori 目标 JSON
const { createLogger } = require("./logger");
const { buildActiveQuotePairs } = require("./converter/quoteTools");
const { convertTalkAction } = require("./converter/talkActionConverter");
const { convertLayoutAction } = require("./converter/layoutActionConverter");
const { collectActionStats } = require("./converter/actionStats");

const logger = createLogger("src.converter");

class ProjectConverter {
  // 初始化转换器（处理头像映射）
  constructor(avatarMapping = {}) {
    this.avatarMapping = avatarMapping || {};
  }

  // 根据头像映射把输入角色 ID 转成输出角色 ID。
  mapOutputId(charId) {
    const mapped =
      this.avatarMapping[charId] ?? this.avatarMapping[String(charId)];
    return mapped ?? charId;
  }

  // 把项目动作序列转换为目标 JSON 字符串，并输出关键统计日志。
  convert(
    projectFile,
    quoteConfig = null,
    narratorName = " ",
    appendSpaces = 0,
    appendSpacesBeforeNewline = 0,
  ) {
    logger.info(
      `开始转换项目 - 旁白名称: '${narratorName}', 结尾空格: ${appendSpaces}, 换行前补空格: ${appendSpacesBeforeNewline}`,
    );

    const projectActions = Array.isArray(projectFile.actions)
      ? projectFile.actions
      : [];
    const activeQuotePairs = buildActiveQuotePairs(quoteConfig);
    const mapOutputId = this.mapOutputId.bind(this);
    const actions = [];

    for (const action of projectActions) {
      if (action?.type === "talk") {
        actions.push(
          convertTalkAction({
            talkAction: action,
            activeQuotePairs,
            narratorName,
            appendSpaces,
            appendSpacesBeforeNewline,
            mapOutputId,
            logger,
          }),
        );
      } else if (action?.type === "layout") {
        actions.push(convertLayoutAction(action, mapOutputId, logger));
      }
    }

    const stats = collectActionStats(actions);
    const globalSettings = projectFile.globalSettings || {};

    logger.info(
      `转换统计 - 对话动作: ${stats.talkCount}, 布局动作: ${stats.layoutCount}, 涉及角色数: ${stats.characterCount}`,
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
}

module.exports = { ProjectConverter };
