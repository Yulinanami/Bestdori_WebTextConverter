import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";
import { motionManager, expressionManager } from "./genericConfigManager.js";
import { historyManager } from "./historyManager.js";
import { projectManager } from "./projectManager.js";
// --- 核心修正：在这里添加对 costumeManager 和 positionManager 的导入 ---
import { costumeManager } from "./costumeManager.js";
import { positionManager } from "./positionManager.js";

export const expressionEditor = {
  projectFileState: null,
  stagedCharacters: [], // 存储所有登场过的角色信息

  init() {
    // 1. 绑定打开编辑器的按钮
    document.getElementById("openExpressionEditorBtn")?.addEventListener("click", () => this.open());
    
    // 2. 绑定模态框内的所有功能按钮
    document.getElementById("saveExpressionsBtn")?.addEventListener("click", () => this.save());
    document.getElementById("importExpressionsBtn")?.addEventListener("click", () => this.importProject());
    document.getElementById("exportExpressionsBtn")?.addEventListener("click", () => this.exportProject());
    document.getElementById("resetExpressionsBtn")?.addEventListener("click", () => this.reset());
    document.getElementById("expressionUndoBtn")?.addEventListener("click", () => historyManager.undo());
    document.getElementById("expressionRedoBtn")?.addEventListener("click", () => historyManager.redo());
    document.getElementById("addTempMotionBtn")?.addEventListener("click", () => this._addTempItem('motion'));
    document.getElementById("addTempExpressionBtn")?.addEventListener("click", () => this._addTempItem('expression'));

    // 3. 统一处理关闭事件（取消和X按钮）
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
    
    // 4. 监听历史变化以更新撤销/重做按钮的状态
    document.addEventListener('historychange', (e) => {
        // 确保只在当前模态框可见时才更新按钮
        if (document.getElementById('expressionEditorModal').style.display === 'flex') {
            const undoBtn = document.getElementById('expressionUndoBtn');
            const redoBtn = document.getElementById('expressionRedoBtn');
            if (undoBtn) undoBtn.disabled = !e.detail.canUndo;
            if (redoBtn) redoBtn.disabled = !e.detail.canRedo;
        }
    });
    
    // 5. 为模态框添加键盘快捷键支持
    modal?.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; // 避免在输入时触发

        if (e.ctrlKey || e.metaKey) { // Ctrl (Win) 或 Cmd (Mac)
            if (e.key === 'z') { 
                e.preventDefault(); 
                historyManager.undo(); 
            }
            else if (e.key === 'y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z'))) { 
                e.preventDefault(); 
                historyManager.redo(); 
            }
        }
    });
  },

    _closeEditor() {
        ui.closeModal("expressionEditorModal");
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
  
  async reset() {
      projectManager.reset(() => {
          // 恢复默认就是清空所有表情/动作
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
      });
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
      this.initDragAndDrop();
      
    } catch (error) {
      ui.showStatus(`加载编辑器失败: ${error.response?.data?.error || error.message}`, "error");
    }
  },

  initDragAndDrop() {
    // a. 初始化右侧资源库 (源)
    ['motion', 'expression'].forEach(type => {
      const libraryList = document.getElementById(`${type}LibraryList`);
      if (libraryList) {
        new Sortable(libraryList, {
          group: {
            name: type, // 每个列表有自己独立的组名
            pull: 'clone',
            put: false
          },
          sort: false,
          onStart: (evt) => {
             // 拖拽时给 item 添加 data 属性
             evt.item.dataset.value = evt.item.textContent;
          }
        });
      }
    });

    // b. 初始化左侧时间线 (作为放置目标的容器)
    // 我们将事件委托给整个时间线容器
    const timeline = document.getElementById('expressionEditorTimeline');
    if(timeline._sortableInitialized) return; // 防止重复初始化

    new Sortable(timeline, {
        group: {
            name: 'timeline-sort', // 用于排序
        },
        // ... (这里的排序逻辑可以后续添加，暂时忽略)
    });
    
    // c. 为所有放置区 (drop zones) 初始化 SortableJS
    document.querySelectorAll('.drop-zone').forEach(zone => {
      new Sortable(zone, {
        group: {
          name: zone.dataset.type, // 组名必须与源匹配 ('motion' 或 'expression')
          put: true
        },
        animation: 150,
        onAdd: (evt) => {
          const item = evt.item; // 被拖入的动作/表情元素
          const value = item.dataset.value;
          
          const dropZone = evt.to;
          const statusTag = dropZone.closest('.character-status-tag');
          const timelineItem = dropZone.closest('.timeline-item');

          if (value && statusTag && timelineItem) {
            const characterId = parseInt(statusTag.dataset.characterId);
            const actionId = timelineItem.dataset.id;
            const type = dropZone.dataset.type; // 'motion' or 'expression'
            
            this._updateCharacterState(actionId, characterId, type, value);
          }
          
          // 移除 SortableJS 留下的临时 DOM
          item.remove();
        }
      });
    });
    timeline._sortableInitialized = true;
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