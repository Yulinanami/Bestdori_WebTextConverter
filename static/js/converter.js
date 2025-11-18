// 文本转换管理
import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { quoteManager } from "./quoteManager.js";
import { apiService } from "./services/ApiService.js";

/**
 * 将纯文本转换为项目文件格式
 * 自动识别"角色名:对话"格式，未匹配的内容作为旁白
 * @param {string} text - 输入文本，段落间用空行分隔
 * @returns {Object} 项目文件对象 { version, actions }
 */
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
  // 转换文本为 Bestdori JSON 格式
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
    const appendSpaces =
      parseInt(document.getElementById("appendSpaces").value, 10) || 0;
    const appendSpacesBeforeNewline =
      parseInt(
        document.getElementById("appendSpacesBeforeNewline").value,
        10
      ) || 0;

    this.convertFromProjectFile(
      projectFileToConvert,
      selectedQuotes,
      narratorName,
      appendSpaces,
      appendSpacesBeforeNewline
    );
  },

  async convertFromProjectFile(
    projectFile,
    selectedQuotes = [],
    narratorName,
    appendSpaces = 0,
    appendSpacesBeforeNewline = 0
  ) {
    const buttonId = "convertBtn";
    try {
      ui.setButtonLoading(buttonId, true, "转换中...");
      ui.showProgress(10);
      ui.showStatus("正在发送项目数据...", "info");

      const data = await apiService.convertText(
        projectFile,
        selectedQuotes,
        narratorName,
        appendSpaces,
        appendSpacesBeforeNewline
      );
      const result = data.result;

      ui.showProgress(100);
      state.set("currentResult", result);
      document.getElementById("resultContent").textContent = result;
      Prism.highlightElement(document.getElementById("resultContent"));
      const resultSection = document.getElementById("resultSection");
      resultSection.style.display = "block";
      ui.showStatus("转换完成！", "success");
      resultSection.scrollIntoView({ behavior: "smooth" });

      setTimeout(() => ui.hideProgress(), 1000);
    } catch (error) {
      ui.showStatus(error.message, "error");
      ui.hideProgress();
    } finally {
      ui.setButtonLoading(buttonId, false);
    }
  },
};
