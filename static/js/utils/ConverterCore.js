// 把"纯文本剧本"转换成"项目文件(projectFile)"结构（不依赖 DOM/全局状态）。
import { state } from "@managers/stateManager.js";

// 把角色配置（角色名 -> ids）变成 Map，方便快速用角色名查到 characterId
function buildCharacterMap(characterConfig = {}) {
  return new Map(
    Object.entries(characterConfig).map(([name, ids]) => [
      name,
      { characterId: ids?.[0], name },
    ]),
  );
}

// 获取说话人分隔符正则表达式（从配置读取）
function getSpeakerPattern() {
  const configData = state.get("configData");
  const patternStr = configData?.patterns?.speaker_pattern;

  if (patternStr) {
    try {
      // 从配置字符串创建正则表达式，添加 s 标志以支持跨行匹配
      return new RegExp(patternStr, "s");
    } catch (e) {
      console.warn("无效的 speaker_pattern 正则表达式，使用默认值:", e);
    }
  }

  // 默认正则：匹配 "角色名：台词" 或 "角色名: 台词"
  return /^(.*?)\s*[：:]\s*(.*)$/s;
}

// 把输入文本按空行分段，并识别"角色名:台词"，生成 projectFile.actions
export function createProjectFileFromText(text, characterConfig = {}) {
  const segments = text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const characterMap = buildCharacterMap(characterConfig);
  const speakerPattern = getSpeakerPattern();

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
