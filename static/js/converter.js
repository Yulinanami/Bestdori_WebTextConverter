// 文本转换管理
import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { quoteManager } from "./quoteManager.js";
import { dialoguePreview } from "./dialoguePreview.js";
import { ResultCache, PreviewCache } from "./cache.js";
import { positionManager } from "./positionManager.js";

const resultCache = new ResultCache();
const previewCache = new PreviewCache();
export const converter = {
  async convertText() {
    const inputText = document.getElementById("inputText").value.trim();
    const narratorName = document.getElementById("narratorName").value || " ";
    if (!inputText) {
      ui.showStatus("请输入要转换的文本！", "error");
      return;
    }
    const selectedQuotePairs = quoteManager.getSelectedQuotes();
    const cacheConfig = {
      narratorName,
      selectedQuotePairs,
      characterMapping: state.get("currentConfig"),
      enableLive2D: state.get("enableLive2D"),
      costumeMapping: state.get("currentCostumes"),
      positionConfig: {
        autoPositionMode: positionManager.autoPositionMode,
        manualPositions: positionManager.manualPositions,
      },
    };
    const cacheKey = resultCache.generateKey(inputText, cacheConfig);
    const cachedResult = resultCache.get(cacheKey);
    if (cachedResult) {
      resultCache.hits = (resultCache.hits || 0) + 1;
      console.log("使用缓存结果");
      state.set("currentResult", cachedResult);
      document.getElementById("resultContent").textContent = cachedResult;
      Prism.highlightElement(document.getElementById("resultContent"));
      document.getElementById("resultSection").style.display = "block";
      ui.showStatus("转换完成！(使用缓存)", "success");
      ui.scrollToElement("resultSection");
      return;
    }
    resultCache.requests = (resultCache.requests || 0) + 1;
    try {
      ui.setButtonLoading("convertBtn", true, "转换中...");
      ui.showProgress(10);
      ui.showStatus("正在处理文本...", "info");
      const response = await axios.post("/api/convert", {
        text: inputText,
        narrator_name: narratorName,
        selected_quote_pairs: selectedQuotePairs,
        character_mapping: state.get("currentConfig"),
        enable_live2d: state.get("enableLive2D"),
        costume_mapping: state.get("currentCostumes"),
        position_config: cacheConfig.positionConfig,
      });
      ui.showProgress(100);
      const result = response.data.result;
      resultCache.set(cacheKey, result);
      state.set("currentResult", result);
      document.getElementById("resultContent").textContent = result;
      Prism.highlightElement(document.getElementById("resultContent"));
      document.getElementById("resultSection").style.display = "block";
      ui.showStatus("转换完成！", "success");
      ui.scrollToElement("resultSection");
      setTimeout(() => ui.hideProgress(), 1000);
    } catch (error) {
      ui.showStatus(
        `转换失败: ${error.response?.data?.error || error.message}`,
        "error"
      );
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

export { resultCache };