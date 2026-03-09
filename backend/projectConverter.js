// 把项目数据转成结果 JSON
const { createLogger } = require("./logger");
const { buildActiveQuotePairs } = require("./converter/quoteTools");
const { convertTalkAction } = require("./converter/talkActionConverter");
const { convertLayoutAction } = require("./converter/layoutActionConverter");
const { collectActionStats } = require("./converter/actionStats");

const logger = createLogger("src.converter");

class ProjectConverter {
  // 保存头像映射
  constructor(avatarMapping = {}) {
    this.avatarMapping = avatarMapping || {};
  }

  // 计算角色头像 ID
  mapOutputId(charId) {
    const mapped =
      this.avatarMapping[charId] ?? this.avatarMapping[String(charId)];
    return mapped ?? charId;
  }

  // 转换整个项目
  convert(
    projectFile,
    quoteConfig = null,
    narratorName = " ",
    appendSpaces = 0,
    padBeforeNewline = 0,
  ) {
    logger.info(
      `开始转换项目 - 旁白名称: '${narratorName}', 结尾空格: ${appendSpaces}, 换行前补空格: ${padBeforeNewline}`,
    );

    const projectActions = Array.isArray(projectFile.actions)
      ? projectFile.actions
      : [];
    const activeQuotePairs = buildActiveQuotePairs(quoteConfig);
    const mapOutputId = this.mapOutputId.bind(this);
    const actions = [];

    // 按编辑器里的顺序逐条转换 只认 talk 和 layout
    for (const action of projectActions) {
      if (action?.type === "talk") {
        actions.push(
          convertTalkAction({
            talkAction: action,
            activeQuotePairs,
            narratorName,
            appendSpaces,
            padBeforeNewline,
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

    // 按固定字段顺序输出 方便结果保持稳定
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
