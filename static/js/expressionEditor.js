import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";
import { motionManager, expressionManager } from "./genericConfigManager.js";
import { historyManager } from "./historyManager.js";
import { projectManager } from "./projectManager.js";
import { costumeManager } from "./costumeManager.js";
import { positionManager } from "./positionManager.js";

export const expressionEditor = {
  projectFileState: null,
  originalStateOnOpen: null,
  stagedCharacters: [],
  
  init() {
    // 1. 绑定功能按钮
    document.getElementById("openExpressionEditorBtn")?.addEventListener("click", () => this.open());
    document.getElementById("saveExpressionsBtn")?.addEventListener("click", () => this.save());
    document.getElementById("importExpressionsBtn")?.addEventListener("click", () => this.importProject());
    document.getElementById("exportExpressionsBtn")?.addEventListener("click", () => this.exportProject());
    document.getElementById("resetExpressionsBtn")?.addEventListener("click", () => this.reset());
    document.getElementById("expressionUndoBtn")?.addEventListener("click", () => historyManager.undo());
    document.getElementById("expressionRedoBtn")?.addEventListener("click", () => historyManager.redo());
    document.getElementById("addTempMotionBtn")?.addEventListener("click", () => this._addTempItem('motion'));
    document.getElementById("addTempExpressionBtn")?.addEventListener("click", () => this._addTempItem('expression'));

    // 2. 统一处理关闭事件
    const modal = document.getElementById('expressionEditorModal');
    const handleCloseAttempt = (e) => {
        if (JSON.stringify(this.projectFileState) !== this.originalStateOnOpen) {
             if (!confirm("您有未保存的更改，确定要关闭吗？")) {
                e.stopPropagation(); e.preventDefault(); return;
             }
        }
        this._closeEditor();
    };
    modal?.querySelector('.btn-modal-close')?.addEventListener('click', handleCloseAttempt);
    modal?.querySelector('.modal-close')?.addEventListener('click', handleCloseAttempt);

    // 3. 监听历史变化
    document.addEventListener('historychange', (e) => {
        if (document.getElementById('expressionEditorModal').style.display === 'flex') {
            const undoBtn = document.getElementById('expressionUndoBtn');
            const redoBtn = document.getElementById('expressionRedoBtn');
            if (undoBtn) undoBtn.disabled = !e.detail.canUndo;
            if (redoBtn) redoBtn.disabled = !e.detail.canRedo;
        }
    });

    // 4. 添加键盘快捷键
    modal?.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') { e.preventDefault(); historyManager.undo(); }
            else if (e.key === 'y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z'))) { e.preventDefault(); historyManager.redo(); }
        }
    });
  },

  _executePropertyChangeCommand(actionId, characterId, type, newValue) {
    let oldValue = '--';
    const action = this.projectFileState.actions.find(a => a.id === actionId);
    if (!action) return;

    if (action.type === 'talk' && action.characterStates && action.characterStates[characterId]) {
      oldValue = action.characterStates[characterId][type] || '--';
    } else if (action.type === 'layout' && action.characterId === characterId) {
      oldValue = action.initialState ? action.initialState[type] || '--' : '--';
    }

    if (oldValue === newValue) return;

    const command = {
      execute: () => {
        this._applyCharacterStateChange(actionId, characterId, type, newValue);
        this._updateSingleTagUI(actionId, characterId, type, newValue);
      },
      undo: () => {
        this._applyCharacterStateChange(actionId, characterId, type, oldValue);
        this._updateSingleTagUI(actionId, characterId, type, oldValue);
      }
    };
    historyManager.do(command);
  },

  _applyCharacterStateChange(actionId, characterId, type, value) {
    const action = this.projectFileState.actions.find(a => a.id === actionId);
    if (!action) return;

    const valueToStore = value === '--' ? '' : value;

    if (action.type === 'talk') {
      if (!action.characterStates) action.characterStates = {};
      if (!action.characterStates[characterId]) action.characterStates[characterId] = {};
      action.characterStates[characterId][type] = valueToStore;
    } else if (action.type === 'layout' && action.characterId === characterId) {
      if (!action.initialState) action.initialState = {};
      action.initialState[type] = valueToStore;
    }
  },

  _updateSingleTagUI(actionId, characterId, type, value) {
      const timelineItem = document.querySelector(`.timeline-item[data-id="${actionId}"]`);
      if (!timelineItem) return;
      const statusTag = timelineItem.querySelector(`.character-status-tag[data-character-id="${characterId}"]`);
      if (!statusTag) return;
      const dropZone = statusTag.querySelector(`.${type}-drop-zone`);
      if(dropZone) {
          dropZone.querySelector('.drop-zone-value').textContent = value;
          const clearBtn = dropZone.querySelector('.clear-state-btn');
          if (clearBtn) {
              clearBtn.style.display = (value && value !== '--') ? 'block' : 'none';
          }
      }
  },

  save() {
    projectManager.save(this.projectFileState, (savedState) => {
        this.originalStateOnOpen = JSON.stringify(savedState);
        this._closeEditor();
    });
  },

  exportProject() {
      projectManager.export(this.projectFileState);
  },

  async importProject() {
      const importedProject = await projectManager.import();
      if (importedProject) {
          this.projectFileState = importedProject;
          this.originalStateOnOpen = JSON.stringify(importedProject);
          state.set('projectFile', JSON.parse(JSON.stringify(importedProject)));
          historyManager.clear();
          this.stagedCharacters = this._calculateStagedCharacters(this.projectFileState);
          this.renderTimeline();
      }
  },
  
  reset() {
      projectManager.reset(() => {
          const newState = JSON.parse(JSON.stringify(this.projectFileState));
          newState.actions.forEach(action => {
              if (action.type === 'talk') action.characterStates = {};
              else if (action.type === 'layout') action.initialState = {};
          });
          return newState;
      }, (newState) => {
          this.projectFileState = newState;
          this.originalStateOnOpen = JSON.stringify(newState);
          historyManager.clear();
          this.renderTimeline();
          // --- 核心修正 3: 重绘后重新初始化拖拽 ---
          this.initDragAndDrop();
      });
  },

  async open() {
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
      this.originalStateOnOpen = JSON.stringify(this.projectFileState);

      this.stagedCharacters = this._calculateStagedCharacters(this.projectFileState);
      historyManager.clear();
      ui.openModal("expressionEditorModal");
      
      this.renderTimeline();
      this.renderLibraries();
      this.initDragAndDrop();
      
      document.getElementById('expressionEditorModal')?.focus();
      
      const timeline = document.getElementById('expressionEditorTimeline');
      // 使用 .onclick 和 .onchange 覆盖旧监听器，防止重复绑定
      timeline.onclick = (e) => {
          const card = e.target.closest('.timeline-item');
          if (!card) return;

          // 处理清除按钮的点击
          if (e.target.matches('.clear-state-btn')) {
              const dropZone = e.target.closest('.drop-zone');
              const statusTag = e.target.closest('.character-status-tag');
              if (dropZone && statusTag) {
                  const actionId = card.dataset.id;
                  const characterId = parseInt(statusTag.dataset.characterId);
                  const type = dropZone.dataset.type;
                  this._executePropertyChangeCommand(actionId, characterId, type, '--');
              }
          }
      };
      
    } catch (error) {
      ui.showStatus(`加载编辑器失败: ${error.response?.data?.error || error.message}`, "error");
    }
  },

  initDragAndDrop() {
    ['motion', 'expression'].forEach(type => {
      const libraryList = document.getElementById(`${type}LibraryList`);
      if (libraryList) {
        new Sortable(libraryList, {
          group: { name: type, pull: 'clone', put: false },
          sort: false,
        });
      }
    });

    document.querySelectorAll('.drop-zone').forEach(zone => {
      new Sortable(zone, {
        group: { name: zone.dataset.type, put: true },
        animation: 150,
        onAdd: (evt) => {
          const sourceList = evt.from;
          const originalItem = sourceList.children[evt.oldDraggableIndex];
          const value = originalItem ? originalItem.textContent : null;
          
          const dropZone = evt.to;
          const statusTag = dropZone.closest('.character-status-tag');
          const timelineItem = dropZone.closest('.timeline-item');

          if (value && statusTag && timelineItem) {
            const characterId = parseInt(statusTag.dataset.characterId);
            const actionId = timelineItem.dataset.id;
            const type = dropZone.dataset.type;
            this._executePropertyChangeCommand(actionId, characterId, type, value);
          }
          evt.item.remove();
        }
      });
    });
  },

  _updateCharacterState(actionId, characterId, type, value) {
    this._executeCommand((currentState) => {
      const action = currentState.actions.find(a => a.id === actionId);
      if (!action) return;

      if (action.type === 'talk') {
        // 确保 characterStates 对象存在
        if (!action.characterStates) action.characterStates = {};
        if (!action.characterStates[characterId]) action.characterStates[characterId] = {};
        
        action.characterStates[characterId][type] = value;

      } else if (action.type === 'layout' && action.characterId === characterId) {
        // layout 卡片只能修改自己的那个角色
        if (!action.initialState) action.initialState = {};
        action.initialState[type] = value;
      }
    });
  },

  _executeCommand(changeFn) {
      const beforeState = JSON.stringify(this.projectFileState);
      const tempState = JSON.parse(beforeState);
      changeFn(tempState);
      const afterState = JSON.stringify(tempState);
      if (beforeState === afterState) return;
      const command = {
          execute: () => {
              this.projectFileState = JSON.parse(afterState);
              this.renderTimeline();
              // --- 核心修正 3: 重绘后重新初始化拖拽 ---
              this.initDragAndDrop();
          },
          undo: () => {
              this.projectFileState = JSON.parse(beforeState);
              this.renderTimeline();
              // --- 核心修正 3: 重绘后重新初始化拖拽 ---
              this.initDragAndDrop();
          }
      };
      historyManager.do(command);
  },

  /**
   * 遍历actions，找出所有执行过appear动作的角色。
   * @param {object} projectFile - 项目文件对象。
   * @returns {Array<{id: number, name: string}>} - 登场过的角色信息数组。
   */
  _calculateStagedCharacters(projectFile) {
    // --- 核心修正：跟踪角色名，而不是角色ID ---
    const appearedCharacterNames = new Set();
    const characters = [];
    
    projectFile.actions.forEach(action => {
      if (action.type === 'layout' && action.layoutType === 'appear') {
        const charName = action.characterName || configManager.getCharacterNameById(action.characterId);
        if (charName && !appearedCharacterNames.has(charName)) {
          appearedCharacterNames.add(charName);
          characters.push({
            id: action.characterId,
            name: charName
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
        return;
      }
      
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

        const motionValue = tag.querySelector('.motion-drop-zone .drop-zone-value');
        const motionClearBtn = tag.querySelector('.motion-drop-zone .clear-state-btn');
        motionValue.textContent = currentMotion;
        if (motionClearBtn) motionClearBtn.style.display = (currentMotion !== '--') ? 'block' : 'none';

        const expValue = tag.querySelector('.expression-drop-zone .drop-zone-value');
        const expClearBtn = tag.querySelector('.expression-drop-zone .clear-state-btn');
        expValue.textContent = currentExpression;
        if (expClearBtn) expClearBtn.style.display = (currentExpression !== '--') ? 'block' : 'none';

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
        // --- 核心修正：添加 draggable="true" 和样式 ---
        itemEl.className = 'config-list-item draggable-item';
        itemEl.draggable = true;
        // --- 结束修正 ---
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