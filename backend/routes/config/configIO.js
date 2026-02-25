// 配置导入导出处理

// 解析并校验导入配置文本。
function configFromText(text) {
  const config = JSON.parse(text);
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("配置验证失败：不是有效的对象");
  }
  if (!config.character_mapping) {
    throw new Error("配置文件中没有有效数据");
  }
  return config;
}

// 组装导出配置结构并生成下载文件名。
function buildConfigExport(data) {
  const config = {
    character_mapping: data.characterMapping,
    custom_quotes: data.customQuotes,
    costume_mapping: data.costumeMapping,
    available_costumes: data.availableCostumes,
    built_in_characters: data.builtInCharacters,
    position_config: {
      autoPositionMode: data.autoPositionMode,
      manualPositions: data.manualPositions,
    },
    custom_motions: data.customMotions,
    custom_expressions: data.customExpressions,
    custom_quick_fill: data.customQuickFill,
    auto_append_spaces: data.autoAppendSpaces,
    auto_append_spaces_before_newline: data.autoAppendSpacesBeforeNewline,
    export_date: new Date().toISOString(),
    version: "1.4",
  };
  const content = JSON.stringify(config, null, 2);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
  const filename = `bestdori_config_${stamp}.json`;
  return { content, filename };
}

module.exports = {
  configFromText,
  buildConfigExport,
};
