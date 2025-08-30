// static/js/speakerEditor.js (新建文件)
import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";

export const speakerEditor = {
  
  // 初始化，绑定打开按钮的事件
  init() {
    const openBtn = document.getElementById("openSpeakerEditorBtn");
    if (openBtn) {
      openBtn.addEventListener("click", () => this.open());
    }
  },

  // 打开编辑器模态框并加载数据
  async open() {
    const rawText = document.getElementById("inputText").value;
    if (!rawText.trim()) {
      ui.showStatus("请输入文本后再打开编辑器。", "error");
      return;
    }

    ui.openModal("speakerEditorModal");

    try {
      // 1. 从后端获取分段文本
      const response = await axios.post("/api/segment-text", { text: rawText });
      const segments = response.data.segments;

      // 2. 初始化项目文件状态 (临时)
      // TODO: 将来这里会加载已有的项目文件
      const projectFile = this.createProjectFileFromSegments(segments);
      
      // 3. 渲染UI
      this.renderCanvas(projectFile);
      this.renderCharacterList();

    } catch (error) {
      ui.showStatus(`加载编辑器失败: ${error.response?.data?.error || error.message}`, "error");
      ui.closeModal("speakerEditorModal");
    }
  },

  // 根据分段文本创建初始的项目文件对象
  createProjectFileFromSegments(segments) {
    const newProjectFile = {
      version: "1.0",
      actions: segments.map((text, index) => ({
        id: `action-id-${Date.now()}-${index}`,
        type: "talk",
        text: text,
        speakers: [], // 初始为空，代表旁白
        characterStates: {}
      }))
    };
    return newProjectFile;
  },

  // 渲染左侧的文本片段卡片
  renderCanvas(projectFile) {
    const canvas = document.getElementById("speakerEditorCanvas");
    const template = document.getElementById("text-snippet-card-template");
    canvas.innerHTML = ""; // 清空
    
    const fragment = document.createDocumentFragment();
    projectFile.actions.forEach(action => {
      if (action.type !== 'talk') return;

      const card = template.content.cloneNode(true);
      const dialogueItem = card.querySelector(".dialogue-item");
      dialogueItem.dataset.id = action.id;

      const dialogueText = card.querySelector(".dialogue-text");
      dialogueText.textContent = action.text;

      // TODO: 根据 action.speakers 的内容显示或隐藏头像和名字
      // 在第一步，我们只显示文本

      fragment.appendChild(card);
    });
    canvas.appendChild(fragment);
  },

  // 渲染右侧的角色列表
  renderCharacterList() {
    const listContainer = document.getElementById("speakerEditorCharacterList");
    const template = document.getElementById("draggable-character-template");
    listContainer.innerHTML = ""; // 清空

    const fragment = document.createDocumentFragment();
    const characters = Object.entries(state.get("currentConfig")).sort(
      ([, idsA], [, idsB]) => idsA[0] - idsB[0]
    );

    characters.forEach(([name, ids]) => {
      const item = template.content.cloneNode(true);
      const characterItem = item.querySelector(".character-item");
      characterItem.dataset.characterId = ids[0];
      characterItem.dataset.characterName = name;
      
      const avatar = item.querySelector(".config-avatar");
      configManager.updateConfigAvatar({ querySelector: () => avatar }, ids[0], name); // 复用更新头像的逻辑

      item.querySelector(".character-name").textContent = name;
      fragment.appendChild(item);
    });
    listContainer.appendChild(fragment);
  }
};