// 对话预览相关功能
import { state } from "./stateManager.js";
import { GRADIENTS } from "./constants.js";
import { ui } from "./uiUtils.js";
import { quoteManager } from "./quoteManager.js";

export const dialoguePreview = {
  // 获取角色头像路径
  getCharacterAvatar(characterId) {
    if (characterId && characterId > 0) {
      return `/static/images/avatars/${characterId}.png`;
    }
    return null;
  },

  // 根据角色ID获取头像渐变色（作为备用方案）
  getAvatarGradient(id) {
    return GRADIENTS[id % GRADIENTS.length];
  },

  // 更新对话预览
  updateDialoguePreview(jsonStr, containerId) {
    const container = document.getElementById(containerId);
    try {
      const data = JSON.parse(jsonStr);
      container.innerHTML = "";

      if (!data.actions || data.actions.length === 0) {
        container.innerHTML =
          '<p style="text-align: center; color: #718096;">没有对话内容</p>';
        return;
      }

      const fragment = document.createDocumentFragment();
      let dialogueIndex = 0;

      data.actions.forEach((action) => {
        if (action.type !== "talk") {
          return;
        }
        const isNarrator =
          !action.name || action.name.trim() === "" || action.name === " ";
        if (isNarrator && (!action.body || action.body.trim() === "")) {
          return;
        }
        const dialogueItem = document.createElement("div");
        dialogueItem.className = `dialogue-item ${
          isNarrator ? "narrator" : ""
        }`;
        dialogueItem.style.animationDelay = `${dialogueIndex * 0.05}s`;
        if (!isNarrator) {
          const characterId =
            action.characters && action.characters[0]
              ? action.characters[0]
              : 0;
          const avatarPath = this.getCharacterAvatar(characterId);
          const avatar = document.createElement("div");
          avatar.className = "dialogue-avatar";
          if (avatarPath && characterId > 0) {
            const img = document.createElement("img");
            img.src = avatarPath;
            img.alt = action.name;
            img.className = "avatar-img";
            avatar.classList.add("loading");
            img.onload = () => {
              avatar.classList.remove("loading");
            };
            img.onerror = () => {
              avatar.classList.remove("loading");
              avatar.innerHTML = action.name.charAt(0);
              avatar.style.background = this.getAvatarGradient(characterId);
              avatar.classList.add("fallback");
            };
            avatar.appendChild(img);
          } else {
            avatar.textContent = action.name.charAt(0);
            avatar.style.background = this.getAvatarGradient(characterId);
            avatar.classList.add("fallback");
          }
          dialogueItem.appendChild(avatar);
        }
        const content = document.createElement("div");
        content.className = "dialogue-content";
        if (!isNarrator) {
          const name = document.createElement("div");
          name.className = "dialogue-name";
          name.textContent = action.name;
          content.appendChild(name);
        }
        const text = document.createElement("div");
        text.className = "dialogue-text";
        text.textContent = action.body;
        content.appendChild(text);
        dialogueItem.appendChild(content);
        fragment.appendChild(dialogueItem);
        dialogueIndex++;
      });

      if (dialogueIndex > 0) {
        container.appendChild(fragment);
      } else {
        container.innerHTML =
          '<p style="text-align: center; color: #718096;">没有对话内容</p>';
      }
    } catch (error) {
      container.innerHTML = `<p style="text-align: center; color: #e53e3e;">预览失败: ${error.message}</p>`;
    }
  },

  // 显示对话预览模态框
  async showDialoguePreview() {
    const inputText = document.getElementById("inputText").value.trim();
    if (!inputText) {
      ui.showStatus("请先输入要转换的文本！", "error");
      return;
    }
    await ui.withButtonLoading(
      "previewModeBtn",
      async () => {
        const narratorName =
          document.getElementById("narratorName").value || " ";
        const selectedQuotePairs = quoteManager.getSelectedQuotes();
        try {
          const response = await axios.post("/api/convert", {
            text: inputText,
            narrator_name: narratorName,
            selected_quote_pairs: selectedQuotePairs,
            character_mapping: state.get("currentConfig"),
          });
          this.updateDialoguePreview(response.data.result, "dialogueContainer");
          ui.openModal("dialoguePreviewModal");
        } catch (error) {
          ui.showStatus(
            `预览失败: ${error.response?.data?.error || error.message}`,
            "error"
          );
        }
      },
      "生成预览..."
    );
  },
};