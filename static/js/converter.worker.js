// converter.worker.js - 在 Web Worker 中处理文本转换

self.addEventListener("message", function (e) {
  const { type, data } = e.data;

  switch (type) {
    case "convert":
      performConversion(data);
      break;
    case "batch":
      performBatchConversion(data);
      break;
  }
});

function performConversion(data) {
  try {
    const { text, config } = data;
    const result = processText(text, config);
    self.postMessage({
      type: "result",
      data: result,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error.message,
    });
  }
}

function processText(text, config) {
  const lines = text.split("\n");
  const actions = [];
  lines.forEach((line) => {
    const match = line.match(/^([\w\s]+)\s*[：:]\s*(.*)$/);
    if (match) {
      const [, speaker, content] = match;
      actions.push({
        type: "talk",
        name: speaker,
        body: content,
        characters: config.characterMapping[speaker] || [],
      });
    }
  });

  return {
    actions,
    server: 0,
    voice: "",
    background: null,
    bgm: null,
  };
}
