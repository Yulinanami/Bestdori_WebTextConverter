// 把“纯文本剧本”转换成“项目文件(projectFile)”结构（不依赖 DOM/全局状态）。

// 把角色配置（角色名 -> ids）变成 Map，方便快速用角色名查到 characterId
function buildCharacterMap(characterConfig = {}) {
  return new Map(
    Object.entries(characterConfig).map(([name, ids]) => [
      name,
      { characterId: ids?.[0], name },
    ])
  );
}

// 把输入文本按空行分段，并识别“角色名:台词”，生成 projectFile.actions
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
