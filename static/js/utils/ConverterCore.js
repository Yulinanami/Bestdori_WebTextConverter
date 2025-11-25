// 核心转换逻辑：将文本拆分为项目文件格式（无 DOM/状态依赖）

function buildCharacterMap(characterConfig = {}) {
  return new Map(
    Object.entries(characterConfig).map(([name, ids]) => [
      name,
      { characterId: ids?.[0], name },
    ])
  );
}

/**
 * 将纯文本转换为项目文件格式
 * 自动识别"角色名:对话"格式，未匹配的内容作为旁白
 * @param {string} text - 输入文本，段落间用空行分隔
 * @param {Object<string, Array<number>>} characterConfig - 角色配置映射
 * @returns {Object} 项目文件对象 { version, actions }
 */
export function createProjectFileFromText(text, characterConfig = {}) {
  const segments = text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const characterMap = buildCharacterMap(characterConfig);

  return {
    version: "1.0",
    actions: segments.map((segmentText, index) => {
      let speakers = [];
      let cleanText = segmentText;
      const match = segmentText.match(/^(.*?)\s*[：:]\s*(.*)$/s);

      if (match) {
        const potentialSpeakerName = match[1].trim();
        if (characterMap.has(potentialSpeakerName)) {
          speakers.push(characterMap.get(potentialSpeakerName));
          cleanText = match[2].trim();
        }
      }

      return {
        id: `action-id-${Date.now()}-${index}`,
        type: "talk",
        text: cleanText,
        speakers,
        characterStates: {},
      };
    }),
  };
}
