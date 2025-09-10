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
  // 新增: 用于存储临时添加的库项目
  tempLibraryItems: { motion: [], expression: [] },
  
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
    document.getElementById("live2dViewerBtn")?.addEventListener("click", () => this._openLive2dViewers());
    // ================== 新增代码 开始 ==================
    // 为搜索框添加实时输入事件监听
    document.getElementById('motionSearchInput')?.addEventListener('input', (e) => this._filterLibraryList('motion', e));
    document.getElementById('expressionSearchInput')?.addEventListener('input', (e) => this._filterLibraryList('expression', e));
    // ================== 新增代码 结束 ==================

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

  _executePropertyChangeCommand(actionId, characterName, type, newValue) {
    let oldValue = '--';
    const action = this.projectFileState.actions.find(a => a.id === actionId);
    if (!action) return;

    // 核心修改 2: 使用 characterName 读取旧状态
    if (action.type === 'talk' && action.characterStates && action.characterStates[characterName]) {
      oldValue = action.characterStates[characterName][type] || '--';
    } 
    // 注意：layout action 的 initialState 不受影响，因为它只关联单个角色，不存在混淆
    else if (action.type === 'layout' && action.characterName === characterName) {
      oldValue = action.initialState ? action.initialState[type] || '--' : '--';
    }

    if (oldValue === newValue) return;

    const command = {
      execute: () => {
        // 核心修改 3: 将 characterName 传递下去
        this._applyCharacterStateChange(actionId, characterName, type, newValue);
        this._updateSingleTagUI(actionId, characterName, type, newValue);
      },
      undo: () => {
        this._applyCharacterStateChange(actionId, characterName, type, oldValue);
        this._updateSingleTagUI(actionId, characterName, type, oldValue);
      }
    };
    historyManager.do(command);
  },

  _applyCharacterStateChange(actionId, characterName, type, value) {
    const action = this.projectFileState.actions.find(a => a.id === actionId);
    if (!action) return;

    const valueToStore = value === '--' ? '' : value;

    if (action.type === 'talk') {
      if (!action.characterStates) action.characterStates = {};

      // --- 新增的修复逻辑 ---
      // 通过角色名找到在场角色对象，以获取其ID
      const character = this.stagedCharacters.find(c => c.name === characterName);
      if (!character) {
          console.error(`无法为角色 "${characterName}" 找到ID，状态未更新。`);
          return; // 如果找不到角色，则不进行任何操作
      }
      const characterId = character.id; // 获取正确的ID
      // --- 修复逻辑结束 ---

      // 使用 characterId 作为键
      if (!action.characterStates[characterId]) action.characterStates[characterId] = {};
      action.characterStates[characterId][type] = valueToStore;

    } else if (action.type === 'layout' && action.characterName === characterName) {
      if (!action.initialState) action.initialState = {};
      action.initialState[type] = valueToStore;
    }
  },

  _updateSingleTagUI(actionId, characterName, type, value) {
      const timelineItem = document.querySelector(`.timeline-item[data-id="${actionId}"]`);
      if (!timelineItem) return;
      // 使用 data-character-name 进行更精确的查找
      const statusTag = timelineItem.querySelector(`.character-status-tag[data-character-name="${characterName}"]`);
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
      });
  },

  async open() {
    try {
      this.tempLibraryItems = { motion: [], expression: [] };
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

      // ================== 新增代码 开始 ==================
      // 每次打开时，清空搜索框的内容
      const motionSearch = document.getElementById('motionSearchInput');
      const expressionSearch = document.getElementById('expressionSearchInput');
      if (motionSearch) motionSearch.value = '';
      if (expressionSearch) expressionSearch.value = '';
      // ================== 新增代码 结束 ==================

      this.renderTimeline();
      this.renderLibraries();
      document.getElementById('expressionEditorModal')?.focus();
      const timeline = document.getElementById('expressionEditorTimeline');
      
      timeline.onclick = (e) => {
          const card = e.target.closest('.timeline-item');
          if (!card) return;
          if (e.target.matches('.setup-expressions-btn')) {
              this.showExpressionSetupUI(card);
              return;
          }
          if (e.target.matches('.clear-state-btn')) {
              const dropZone = e.target.closest('.drop-zone');
              const statusTag = e.target.closest('.character-status-tag');
              if (dropZone && statusTag) {
                  const actionId = card.dataset.id;
                  const characterName = statusTag.dataset.characterName;
                  const type = dropZone.dataset.type;
                  this._executePropertyChangeCommand(actionId, characterName, type, '--');
              }
              return;
          }
          if (e.target.matches('.layout-remove-btn')) {
            this._deleteLayoutAction(card.dataset.id);
            return;
          }
      };

      timeline.onchange = (e) => {
        const card = e.target.closest('.layout-item');
        if (card && e.target.matches('select, input')) {
            this._updateLayoutActionProperty(card.dataset.id, e.target);
        }
      };

      new Sortable(timeline, {
        group: 'timeline-cards',
        animation: 150,
        sort: true,
        onEnd: (evt) => {
            if (evt.from === evt.to && evt.oldIndex !== evt.newIndex) {
                const { oldIndex, newIndex } = evt;
                this._executeCommand((currentState) => {
                    const [movedItem] = currentState.actions.splice(oldIndex, 1);
                    currentState.actions.splice(newIndex, 0, movedItem);
                });
            }
        }
      });
      
    } catch (error) {
      ui.showStatus(`加载编辑器失败: ${error.response?.data?.error || error.message}`, "error");
    }
  },

  // ================== 新增函数 开始 ==================
  /**
   * 根据输入内容过滤资源库列表
   * @param {'motion' | 'expression'} type - 要过滤的列表类型
   * @param {Event} event - input事件对象
   */
  _filterLibraryList(type, event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    const listContainerId = type === 'motion' ? 'motionLibraryList' : 'expressionLibraryList';
    const listContainer = document.getElementById(listContainerId);
    
    if (!listContainer) return;

    const items = listContainer.querySelectorAll('.config-list-item.draggable-item');

    items.forEach(item => {
      const itemName = item.textContent.toLowerCase();

      // ================== 核心修改：从模糊包含改为前缀匹配 ==================
      if (itemName.startsWith(searchTerm)) {
      // =====================================================================
        item.style.display = ''; // 恢复默认显示
      } else {
        item.style.display = 'none'; // 隐藏不匹配的项
      }
    });
  },
  // ================== 新增函数 结束 ==================

  showExpressionSetupUI(cardElement) {
    const actionId = cardElement.dataset.id;
    const action = this.projectFileState.actions.find(a => a.id === actionId);
    if (!action) return;
    const footer = cardElement.querySelector('.timeline-item-footer');
    if (!footer) return;
    const statusBar = this._renderStatusBarForAction(action);
    footer.innerHTML = '';
    footer.appendChild(statusBar);
    this._initSortableForZones(statusBar);
  },

  _actionHasExpressionData(action) {
    if (action.type === 'talk') {
        return action.characterStates && Object.keys(action.characterStates).length > 0;
    }
    if (action.type === 'layout') {
        return action.initialState && Object.keys(action.initialState).length > 0;
    }
    return false;
  },

  _initSortableForZones(parentElement) {
    parentElement.querySelectorAll('.drop-zone').forEach(zone => {
      new Sortable(zone, {
        group: { 
            name: zone.dataset.type, 
            put: function (to, from, dragEl) {
              return dragEl.classList.contains('draggable-item');
            }
        },
        animation: 150,
        onAdd: (evt) => {
          const value = evt.item ? evt.item.textContent : null;
          const dropZone = evt.to;
          const statusTag = dropZone.closest('.character-status-tag');
          const timelineItem = dropZone.closest('.timeline-item');
          if (value && statusTag && timelineItem) {
            const characterName = statusTag.dataset.characterName;
            const actionId = timelineItem.dataset.id;
            const type = dropZone.dataset.type;
            this._executePropertyChangeCommand(actionId, characterName, type, value);
          }
          evt.item.remove();
        }
      });
    });
  },

  initDragAndDropForLibraries() {
    ['motion', 'expression'].forEach(type => {
      const libraryList = document.getElementById(`${type}LibraryList`);
      if (libraryList) {
        new Sortable(libraryList, {
          group: { name: type, pull: 'clone', put: false },
          sort: false,
        });
      }
    });
  },

  _calculateStagedCharacters(projectFile) {
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

  renderTimeline() {
    const timeline = document.getElementById("expressionEditorTimeline");
    const talkTemplate = document.getElementById("timeline-talk-card-template");
    const layoutTemplate = document.getElementById("timeline-layout-card-template");
    
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
      
      const footer = card.querySelector('.timeline-item-footer');
      if (this._actionHasExpressionData(action)) {
          const statusBar = this._renderStatusBarForAction(action);
          footer.appendChild(statusBar);
          this._initSortableForZones(statusBar);
      } else {
          const setupButton = document.createElement('button');
          setupButton.className = 'btn btn-secondary btn-sm setup-expressions-btn';
          setupButton.textContent = '设置动作/表情';
          footer.appendChild(setupButton);
      }

      fragment.appendChild(card);
    });
    timeline.appendChild(fragment);
  },

  _renderStatusBarForAction(action) {
    const statusTagTemplate = document.getElementById("character-status-tag-template");
    const statusBar = document.createElement('div');
    statusBar.className = 'character-status-bar';

    if (action.type === 'talk') {
      this.stagedCharacters.forEach(char => {
        const tag = statusTagTemplate.content.cloneNode(true);
        const statusTagElement = tag.querySelector('.character-status-tag');
        statusTagElement.dataset.characterId = char.id;
        statusTagElement.dataset.characterName = char.name;

        const avatarDiv = tag.querySelector('.dialogue-avatar');
        configManager.updateConfigAvatar({ querySelector: () => avatarDiv }, char.id, char.name);
        tag.querySelector('.character-name').textContent = char.name;

        const currentState = action.characterStates?.[char.name] || {};
        const currentMotion = currentState.motion || '--';
        const currentExpression = currentState.expression || '--';
        
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

    } else if (action.type === 'layout') {
      const char = {
          id: action.characterId,
          name: action.characterName || configManager.getCharacterNameById(action.characterId)
      };

      if (!char.name) return statusBar;

      const tag = statusTagTemplate.content.cloneNode(true);
      const statusTagElement = tag.querySelector('.character-status-tag');
      statusTagElement.dataset.characterId = char.id;
      statusTagElement.dataset.characterName = char.name;

      const avatarDiv = tag.querySelector('.dialogue-avatar');
      configManager.updateConfigAvatar({ querySelector: () => avatarDiv }, char.id, char.name);
      tag.querySelector('.character-name').textContent = char.name;

      const currentState = action.initialState || {};
      const currentMotion = currentState.motion || '--';
      const currentExpression = currentState.expression || '--';

      const motionValue = tag.querySelector('.motion-drop-zone .drop-zone-value');
      const motionClearBtn = tag.querySelector('.motion-drop-zone .clear-state-btn');
      motionValue.textContent = currentMotion;
      if (motionClearBtn) motionClearBtn.style.display = (currentMotion !== '--') ? 'block' : 'none';

      const expValue = tag.querySelector('.expression-drop-zone .drop-zone-value');
      const expClearBtn = tag.querySelector('.expression-drop-zone .clear-state-btn');
      expValue.textContent = currentExpression;
      if (expClearBtn) expClearBtn.style.display = (currentExpression !== '--') ? 'block' : 'none';
      
      statusBar.appendChild(tag);
    }

    return statusBar;
  },

  renderLibraries() {
    // 1. 获取当前所有在场角色的 ID 集合
    const stagedCharacterIds = new Set(this.stagedCharacters.map(c => c.id));
    
    // 2. 根据在场角色，合并他们所有的动作和表情
    const motionItems = new Set(this.tempLibraryItems.motion);
    const expressionItems = new Set(this.tempLibraryItems.expression);

    stagedCharacterIds.forEach(id => {
        motionManager.getAvailableItemsForCharacter(id).forEach(item => motionItems.add(item));
        expressionManager.getAvailableItemsForCharacter(id).forEach(item => expressionItems.add(item));
    });

    // 如果没有任何在场角色，则显示所有已知的动作/表情作为备用
    if (stagedCharacterIds.size === 0) {
        motionManager.getAllKnownItems().forEach(item => motionItems.add(item));
        expressionManager.getAllKnownItems().forEach(item => expressionItems.add(item));
    }

    // 3. 渲染列表
    this._renderLibrary('motion', Array.from(motionItems).sort());
    this._renderLibrary('expression', Array.from(expressionItems).sort());
    
    this.initDragAndDropForLibraries();
  },

  _renderLibrary(type, items) {
    const container = document.getElementById(`${type}LibraryList`);
    container.innerHTML = "";
    const fragment = document.createDocumentFragment();
    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'config-list-item draggable-item';
        itemEl.draggable = true;
        itemEl.innerHTML = `<span class="item-name">${item}</span>`;
        fragment.appendChild(itemEl);
    });
    container.appendChild(fragment);
  },
  
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
          },
          undo: () => {
              this.projectFileState = JSON.parse(beforeState);
              this.renderTimeline();
          }
      };
      historyManager.do(command);
  },

  _deleteLayoutAction(actionId) {
      this._executeCommand((currentState) => {
          currentState.actions = currentState.actions.filter(a => a.id !== actionId);
      });
  },

  _updateLayoutActionProperty(actionId, targetElement) {
    const value = targetElement.type === 'number' ? parseInt(targetElement.value) || 0 : targetElement.value;
    const controlClassName = targetElement.className;

    this._executeCommand((currentState) => {
      const action = currentState.actions.find(a => a.id === actionId);
      if (!action) return;
      
      if (controlClassName.includes('layout-type-select')) {
          action.layoutType = value;
      } else if (controlClassName.includes('layout-costume-select')) {
          action.costume = value;
      } else if (controlClassName.includes('layout-position-select-to')) {
          if (!action.position) action.position = {};
          if (!action.position.to) action.position.to = {};
          action.position.to.side = value;
      } else if (controlClassName.includes('layout-offset-input-to')) {
          if (!action.position) action.position = {};
          if (!action.position.to) action.position.to = {};
          action.position.to.offsetX = value;
      } else if (controlClassName.includes('layout-position-select')) {
          if (!action.position) action.position = {};
          if (!action.position.from) action.position.from = {};
          action.position.from.side = value;
          if (action.layoutType !== 'move') {
              if (!action.position.to) action.position.to = {};
              action.position.to.side = value;
          }
      } else if (controlClassName.includes('layout-offset-input')) {
          if (!action.position) action.position = {};
          if (!action.position.from) action.position.from = {};
          action.position.from.offsetX = value;
          if (action.layoutType !== 'move') {
              if (!action.position.to) action.position.to = {};
              action.position.to.offsetX = value;
          }
      }
    });
  },

_addTempItem(type) {
    const isMotion = type === 'motion';
    const input = document.getElementById(isMotion ? 'tempMotionInput' : 'tempExpressionInput');
    const manager = isMotion ? motionManager : expressionManager;
    const tempList = this.tempLibraryItems[type];
    
    const trimmedId = input.value.trim();
    if (!trimmedId) {
      ui.showStatus(`${manager.name}ID不能为空！`, "error");
      return;
    }

    const allItems = new Set([...manager.getAvailableItems(), ...tempList]);
    if (allItems.has(trimmedId)) {
      ui.showStatus(`该${manager.name}ID已存在！`, "error");
      return;
    }

    tempList.push(trimmedId);
    input.value = "";
    this.renderLibraries();
    ui.showStatus(`已添加临时${manager.name}：${trimmedId}`, "success");
  },

  _openLive2dViewers() {
    if (!this.projectFileState || !this.projectFileState.actions) {
      ui.showStatus("没有可分析的剧情内容。", "error");
      // 作为备用方案，打开默认的浏览器首页
      window.open('https://bestdori.com/tool/live2d', '_blank');
      return;
    }

    // 1. 使用 Set 收集所有不重复的服装ID
    const costumeIds = new Set();
    this.projectFileState.actions.forEach(action => {
      // 只关心 layout 动作，并且它必须有 costume 属性
      if (action.type === 'layout' && action.costume) {
        costumeIds.add(action.costume);
      }
    });

    // 2. 处理没有找到任何服装的情况
    if (costumeIds.size === 0) {
      ui.showStatus("当前时间线中未找到任何服装配置，将打开 Live2D 浏览器首页。", "info");
      window.open('https://bestdori.com/tool/live2d', '_blank');
      return;
    }

    const costumeArray = Array.from(costumeIds);

    // 3. 如果要打开的窗口太多，给用户一个提示
    if (costumeArray.length > 5) {
      if (!confirm(`你即将为 ${costumeArray.length} 个不同的服装打开新的浏览器标签页，确定要继续吗？`)) {
        return; // 用户取消操作
      }
    }

    // 4. 遍历 Set 并打开所有窗口
    ui.showStatus(`正在为 ${costumeArray.length} 个服装打开 Live2D 浏览器...`, "success");
    costumeArray.forEach(costumeId => {
      const url = `https://bestdori.com/tool/live2d/asset/jp/live2d/chara/${costumeId}`;
      window.open(url, '_blank');
    });
  },

  _closeEditor() {
    ui.closeModal("expressionEditorModal");
  }
};