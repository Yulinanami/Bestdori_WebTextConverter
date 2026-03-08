// 把纯文本转成项目数据
import { state } from "@managers/stateManager.js";

// 把角色设置整理成方便查找的表
function buildCharacterMap(characterConfig = {}) {
  return new Map(
    Object.entries(characterConfig).map(([name, ids]) => [
      name,
      { characterId: ids?.[0], name },
    ]),
  );
}

// 读取说话人匹配规则
function buildSpeakerPattern() {
  const configData = state.configData;
  const patternStr = configData?.patterns?.speaker_pattern;

  if (patternStr) {
    try {
      // 用配置里的规则生成正则
      return new RegExp(patternStr, "s");
    } catch (error) {
      console.warn("无效的 speaker_pattern 正则表达式，使用默认值:", error);
    }
  }

  // 没配时用默认规则
  return /^(.*?)\s*[：:]\s*(.*)$/s;
}

// 把输入文字转成项目数据
export function createProjectFileFromText(text, characterConfig = {}) {
  const segments = text
    .split(/\n\s*\n/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const characterMap = buildCharacterMap(characterConfig);
  const speakerPattern = buildSpeakerPattern();

  return {
    version: "1.0",
    actions: segments.map((segmentText, index) => {
      let speakers = [];
      let cleanText = segmentText;
      const match = segmentText.match(speakerPattern);

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
      };
    }),
  };
}
