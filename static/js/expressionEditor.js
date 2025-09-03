// static/js/expressionEditor.js (新建文件)

import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";
import { motionManager, expressionManager } from "./genericConfigManager.js";

export const expressionEditor = {
  projectFileState: null,
  stagedCharacters: [], // 存储所有登场过的角色信息

  init() {
    document.getElementById("openExpressionEditorBtn")?.addEventListener("click", () => this.open());
    // TODO: 绑定保存、撤销、添加临时项等按钮事件
  },

  async open() {
    // 复用 live2dEditor 的独立打开逻辑
    try {
      let initialState;
      const rawText = document.getElementById("inputText").value;
      if (state.get('projectFile')) {
        initialState = state.get('projectFile');
      } else {
        const response = await axios.post("/api/segment-text", { text: rawText });
        initialState = this._createProjectFileFromSegments(response.data.segments);
      }
      this.projectFileState = JSON.parse(JSON.stringify(initialState));

      // 1. 计算所有登场过的角色 (一次性)
      this.stagedCharacters = this._calculateStagedCharacters(this.projectFileState);

      ui.openModal("expressionEditorModal");
      
      this.renderTimeline();
      this.renderLibraries();
      
    } catch (error) {
      ui.showStatus(`加载编辑器失败: ${error.response?.data?.error || error.message}`, "error");
    }
  },

  /**
   * 遍历actions，找出所有执行过appear动作的角色。
   * @param {object} projectFile - 项目文件对象。
   * @returns {Array<{id: number, name: string}>} - 登场过的角色信息数组。
   */
  _calculateStagedCharacters(projectFile) {
    const appearedCharacterIds = new Set();
    const characters = [];
    projectFile.actions.forEach(action => {
      if (action.type === 'layout' && action.layoutType === 'appear') {
        if (!appearedCharacterIds.has(action.characterId)) {
          appearedCharacterIds.add(action.characterId);
          characters.push({
            id: action.characterId,
            name: action.characterName || configManager.getCharacterNameById(action.characterId)
          });
        }
      }
    });
    return characters;
  },

  /**
   * 渲染左侧的时间线。
   */
  renderTimeline() {
    const timeline = document.getElementById("expressionEditorTimeline");
    const talkTemplate = document.getElementById("timeline-talk-card-template");
    const layoutTemplate = document.getElementById("timeline-layout-card-template");
    const statusTagTemplate = document.getElementById("character-status-tag-template");
    timeline.innerHTML = "";
    
    const fragment = document.createDocumentFragment();

    this.projectFileState.actions.forEach(action => {
      let card;
      
      // --- START: 无省略的 if/else 语句 ---
      if (action.type === 'talk') {
        card = talkTemplate.content.cloneNode(true);
        const item = card.querySelector('.timeline-item');
        item.dataset.id = action.id;
        
        const nameDiv = card.querySelector('.speaker-name');
        const avatarDiv = card.querySelector('.dialogue-avatar');
        
        if (action.speakers && action.speakers.length > 0) {
          const firstSpeaker = action.speakers[0];
          nameDiv.textContent = action.speakers.map(s => s.name).join(' & ');
          configManager.updateConfigAvatar({ querySelector: () => avatarDiv }, firstSpeaker.characterId, firstSpeaker.name);
        } else {
          nameDiv.textContent = "旁白";
          avatarDiv.classList.add('fallback');
          avatarDiv.textContent = 'N';
        }
        
        card.querySelector('.dialogue-preview-text').textContent = action.text;

      } else if (action.type === 'layout') {
        card = layoutTemplate.content.cloneNode(true);
        const item = card.querySelector('.timeline-item');
        item.dataset.id = action.id;
        item.dataset.layoutType = action.layoutType;

        const characterId = action.characterId;
        const characterName = action.characterName || configManager.getCharacterNameById(characterId);
        
        card.querySelector('.speaker-name').textContent = characterName || `未知角色 (ID: ${characterId})`;
        const avatarDiv = card.querySelector('.dialogue-avatar');
        configManager.updateConfigAvatar({ querySelector: () => avatarDiv }, characterId, characterName);
        
        const typeSelect = card.querySelector('.layout-type-select');
        typeSelect.value = action.layoutType;
        
        const positionSelect = card.querySelector('.layout-position-select');
        const offsetInput = card.querySelector('.layout-offset-input');
        const toPositionSelect = card.querySelector('.layout-position-select-to');
        
        const currentPosition = action.position?.from?.side || 'center';
        const currentOffset = action.position?.from?.offsetX || 0;

        const costumeSelect = card.querySelector('.layout-costume-select');
        costumeSelect.innerHTML = '';
        
        const availableCostumes = costumeManager.availableCostumes[characterName] || [];
        availableCostumes.forEach(costumeId => {
            const option = new Option(costumeId, costumeId);
            costumeSelect.add(option);
        });
        if (action.costume && !availableCostumes.includes(action.costume)) {
            const option = new Option(`${action.costume} (自定义)`, action.costume);
            costumeSelect.add(option, 0);
        }
        costumeSelect.value = action.costume;

        positionSelect.innerHTML = '';
        toPositionSelect.innerHTML = '';
        Object.entries(positionManager.positionNames).forEach(([value, name]) => {
            const optionFrom = new Option(name, value);
            const optionTo = new Option(name, value);
            positionSelect.add(optionFrom);
            toPositionSelect.add(optionTo);
        });
        positionSelect.value = currentPosition;
        offsetInput.value = currentOffset;

        const toPositionContainer = card.querySelector('.to-position-container');
        if (action.layoutType === 'move') {
            toPositionContainer.style.display = 'grid';
            card.querySelector('.layout-position-select-to').value = action.position?.to?.side || 'center';
            card.querySelector('.layout-offset-input-to').value = action.position?.to?.offsetX || 0;
        } else {
            toPositionContainer.style.display = 'none';
        }

      } else {
        return; // 跳过非 talk/layout 动作
      }
      // --- END: 无省略的 if/else 语句 ---
      
      // 为每张卡片添加“在场角色状态栏”
      const statusBar = document.createElement('div');
      statusBar.className = 'character-status-bar';
      
      this.stagedCharacters.forEach(char => {
        const tag = statusTagTemplate.content.cloneNode(true);
        tag.querySelector('.character-status-tag').dataset.characterId = char.id;
        
        const avatarDiv = tag.querySelector('.dialogue-avatar');
        configManager.updateConfigAvatar({ querySelector: () => avatarDiv }, char.id, char.name);
        tag.querySelector('.character-name').textContent = char.name;

        let currentMotion = '--';
        let currentExpression = '--';
        if (action.type === 'talk' && action.characterStates && action.characterStates[char.id]) {
            currentMotion = action.characterStates[char.id].motion || '--';
            currentExpression = action.characterStates[char.id].expression || '--';
        } else if (action.type === 'layout' && action.characterId === char.id) {
            currentMotion = action.initialState?.motion || '--';
            currentExpression = action.initialState?.expression || '--';
        }
        tag.querySelector('.motion-drop-zone .drop-zone-value').textContent = currentMotion;
        tag.querySelector('.expression-drop-zone .drop-zone-value').textContent = currentExpression;

        statusBar.appendChild(tag);
      });
      
      card.querySelector('.timeline-item').appendChild(statusBar);
      fragment.appendChild(card);
    });
    timeline.appendChild(fragment);
  },

  /**
   * 渲染右侧的动作/表情资源库。
   */
  renderLibraries() {
    this._renderLibrary('motion', motionManager.getAvailableItems());
    this._renderLibrary('expression', expressionManager.getAvailableItems());
  },

  _renderLibrary(type, items) {
    const container = document.getElementById(`${type}LibraryList`);
    container.innerHTML = "";
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'config-list-item'; // 复用样式
        itemEl.innerHTML = `<span class="item-name">${item}</span>`;
        fragment.appendChild(itemEl);
    });
    container.appendChild(fragment);
  },
  
  // 这是一个辅助函数，复制自 live2dEditor.js
  _createProjectFileFromSegments(segments) {
    const characterMap = new Map(Object.entries(state.get("currentConfig")).map(([name, ids]) => [name, { characterId: ids[0], name: name }]));
    const newProjectFile = {
      version: "1.0",
      actions: segments.map((text, index) => {
        let speakers = []; let cleanText = text;
        const match = text.match(/^(.*?)\s*[：:]\s*(.*)$/s);
        if (match) {
            const potentialSpeakerName = match[1].trim();
            if (characterMap.has(potentialSpeakerName)) {
                speakers.push(characterMap.get(potentialSpeakerName));
                cleanText = match[2].trim();
            }
        }
        return { id: `action-id-${Date.now()}-${index}`, type: "talk", text: cleanText, speakers: speakers, characterStates: {} };
      })
    };
    return newProjectFile;
  }
};