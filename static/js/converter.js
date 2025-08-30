// 文本转换管理
import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";

// 这是一个临时的辅助函数，用于旧流程的兼容
function createProjectFileFromText(text) {
    const segments = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    const characterMap = new Map(Object.entries(state.get("currentConfig")).map(([name, ids]) => [name, { characterId: ids[0], name: name }]));

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
          characterStates: {}
        };
      })
    };
}

export const converter = {
  async convertText() {
    let projectFileToConvert;

    if (state.get('projectFile')) {
        // 优先使用编辑器保存的项目文件
        projectFileToConvert = state.get('projectFile');
    } else {
        // 如果没有，则基于当前文本框内容动态创建一个
        const inputText = document.getElementById("inputText").value.trim();
        if (!inputText) {
            ui.showStatus("请输入要转换的文本！", "error");
            return;
        }
        projectFileToConvert = createProjectFileFromText(inputText);
    }
    
    // 统一调用基于项目文件的转换流程
    this.convertFromProjectFile(projectFileToConvert);
  },

  /**
   * 基于项目文件对象发送转换请求到后端。
   * @param {object} projectFile - 我们的统一工作配置对象。
   */
  async convertFromProjectFile(projectFile) {
    try {
      ui.setButtonLoading("convertBtn", true, "转换中...");
      ui.showProgress(10);
      ui.showStatus("正在发送项目数据...", "info");

      const response = await axios.post("/api/convert", {
        projectFile: projectFile
      });

      ui.showProgress(100);
      const result = response.data.result;
      
      // 更新全局结果状态，以便下载等功能使用
      state.set("currentResult", result);
      
      document.getElementById("resultContent").textContent = result;
      Prism.highlightElement(document.getElementById("resultContent"));
      document.getElementById("resultSection").style.display = "block";
      ui.showStatus("转换完成！", "success");
      ui.scrollToElement("resultSection");
      setTimeout(() => ui.hideProgress(), 1000);

    } catch (error) {
      ui.showStatus(`转换失败: ${error.response?.data?.error || error.message}`, "error");
      ui.hideProgress();
    } finally {
      ui.setButtonLoading("convertBtn", false);
    }
  },

  // 更新分屏预览
  async updateSplitPreview(isManualRefresh = false) {
    const inputText = document.getElementById("splitInputText").value.trim();
    if (!inputText) {
      document.querySelector("#splitPreviewJson code").textContent =
        "// 请输入文本以查看预览";
      document.getElementById("splitPreviewDialogue").innerHTML =
        '<p style="text-align: center; color: #718096;">请输入文本以查看预览</p>';
      return;
    }
    const narratorName =
      document.getElementById("splitNarratorName").value || " ";
    const selectedQuotePairs = quoteManager.getSelectedQuotes();
    const previewConfig = {
      narratorName,
      selectedQuotePairs,
      enableLive2D: state.get("enableLive2D"),
    };
    const cacheKey = previewCache.generatePreviewKey(inputText, previewConfig);
    const cachedPreview = previewCache.get(cacheKey);
    if (cachedPreview && !isManualRefresh) {
      state.set("currentResult", cachedPreview);
      document.querySelector("#splitPreviewJson code").textContent =
        cachedPreview;
      Prism.highlightElement(document.querySelector("#splitPreviewJson code"));
      dialoguePreview.updateDialoguePreview(
        cachedPreview,
        "splitPreviewDialogue"
      );
      return;
    }
    if (isManualRefresh) {
      ui.setButtonLoading("splitConvertBtn", true, "刷新中...");
    }
    try {
      const response = await axios.post("/api/convert", {
        text: inputText,
        narrator_name: narratorName,
        selected_quote_pairs: selectedQuotePairs,
        character_mapping: state.get("currentConfig"),
        enable_live2d: state.get("enableLive2D"),
        costume_mapping: state.get("currentCostumes"),
        position_config: {
          autoPositionMode: positionManager.autoPositionMode,
          manualPositions: positionManager.manualPositions,
        },
      });
      const jsonResult = response.data.result;
      previewCache.set(cacheKey, jsonResult);
      state.set("currentResult", jsonResult);
      document.querySelector("#splitPreviewJson code").textContent = jsonResult;
      Prism.highlightElement(document.querySelector("#splitPreviewJson code"));
      dialoguePreview.updateDialoguePreview(jsonResult, "splitPreviewDialogue");
    } catch (error) {
      const errorMsg = `转换失败: ${
        error.response?.data?.error || error.message
      }`;
      document.querySelector(
        "#splitPreviewJson code"
      ).textContent = `// ${errorMsg}`;
      document.getElementById(
        "splitPreviewDialogue"
      ).innerHTML = `<p style="text-align: center; color: #e53e3e;">${errorMsg}</p>`;
    } finally {
      if (isManualRefresh) {
        ui.setButtonLoading("splitConvertBtn", false);
      }
    }
  },
};

