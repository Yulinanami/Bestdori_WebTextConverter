// 文本分段：把长文本按空行切成多个段落。
function segmentInputText(rawText = "") {
  const lines = rawText.split(/\r?\n/);
  const segments = [];
  let currentSegment = [];

  lines.forEach((line) => {
    const stripped = line.trim();
    if (stripped) {
      currentSegment.push(stripped);
      return;
    }
    if (currentSegment.length > 0) {
      segments.push(currentSegment.join("\n"));
      currentSegment = [];
    }
  });

  if (currentSegment.length > 0) {
    segments.push(currentSegment.join("\n"));
  }

  return segments;
}

module.exports = {
  segmentInputText,
};
