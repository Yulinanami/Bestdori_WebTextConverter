// 布局动作转换
const { toInt, toNumber } = require("./valueParsers");

// 将单个 layout 动作转换为目标动作结构并记录布局日志。
function convertLayoutAction(layoutAction, mapOutputId, logger) {
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
  logger.info(
    `  位置: ${sideFrom}(${offsetFrom >= 0 ? "+" : ""}${offsetFrom}) -> ${sideTo}(${offsetTo >= 0 ? "+" : ""}${offsetTo})`,
  );
  logger.info(
    `  初始状态 - 动作: ${motion || "无"}, 表情: ${expression || "无"}`,
  );

  return {
    type: "layout",
    delay,
    wait: true,
    layoutType,
    character: mapOutputId(charId),
    costume,
    motion,
    expression,
    sideFrom,
    sideFromOffsetX: offsetFrom,
    sideTo,
    sideToOffsetX: offsetTo,
  };
}

module.exports = {
  convertLayoutAction,
};
