// 文本转换管理
import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { quoteManager } from "./quoteManager.js";

function createProjectFileFromText(text) {
  const segments = text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const characterMap = new Map(
    Object.entries(state.get("currentConfig")).map(([name, ids]) => [
      name,
      { characterId: ids[0], name: name },
    ])
  );

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
        speakers: speakers,
        characterStates: {},
      };
    }),
  };
}

export const converter = {
  async convertText() {
    let projectFileToConvert;

    if (state.get("projectFile")) {
      projectFileToConvert = state.get("projectFile");
    } else {
      const inputText = document.getElementById("inputText").value.trim();
      if (!inputText) {
        ui.showStatus("请输入要转换的文本！", "error");
        return;
      }
      projectFileToConvert = createProjectFileFromText(inputText);
    }

    const selectedQuotes = quoteManager.getSelectedQuotes();
    const narratorName = document.getElementById("narratorName").value || " ";
    this.convertFromProjectFile(
      projectFileToConvert,
      selectedQuotes,
      narratorName
    );
  },

  async convertFromProjectFile(projectFile, selectedQuotes = [], narratorName) {
    const buttonId = "convertBtn";
    try {
      ui.setButtonLoading(buttonId, true, "转换中...");
      ui.showProgress(10);
      ui.showStatus("正在发送项目数据...", "info");

      const response = await axios.post("/api/convert", {
        projectFile: projectFile,
        quoteConfig: selectedQuotes,
        narratorName: narratorName,
      });

      const result = response.data.result;

      ui.showProgress(100);
      state.set("currentResult", result);
      document.getElementById("resultContent").textContent = result;
      Prism.highlightElement(document.getElementById("resultContent"));
      document.getElementById("resultSection").style.display = "block";
      ui.showStatus("转换完成！", "success");
      ui.scrollToElement("resultSection");
      setTimeout(() => ui.hideProgress(), 1000);
    } catch (error) {
      const errorMsg = `转换失败: ${
        error.response?.data?.error || error.message
      }`;
      ui.showStatus(errorMsg, "error");
      ui.hideProgress();
    } finally {
      ui.setButtonLoading(buttonId, false);
    }
  },
};
