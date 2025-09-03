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
  // 调用项目管理器来保存当前状态，并提供一个回调函数
  projectManager.save(this.projectFileState, (savedState) => {
      // 这是保存成功后执行的回调函数

      // 1. 更新 "原始状态"，以防止在关闭时意外触发 "未保存的更改" 警告
      this.originalStateOnOpen = JSON.stringify(savedState);
      
      // 2. 明确地调用UI工具函数来关闭模态框
      ui.closeModal("expressionEditorModal");
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
      
      document.getElementById('expressionEditorModal')?.focus();
      
      const timeline = document.getElementById('expressionEditorTimeline');
      
      // 修改: 合并并扩展事件处理器
      timeline.onclick = (e) => {
          const card = e.target.closest('.timeline-item');
          if (!card) return;

          // 处理 "设置动作/表情" 按钮
          if (e.target.matches('.setup-expressions-btn')) {
              this.showExpressionSetupUI(card);
              return;
          }

          // 处理 "清除" 按钮
          if (e.target.matches('.clear-state-btn')) {
              const dropZone = e.target.closest('.drop-zone');
              const statusTag = e.target.closest('.character-status-tag');
              if (dropZone && statusTag) {
                  const actionId = card.dataset.id;
                  const characterId = parseInt(statusTag.dataset.characterId);
                  const type = dropZone.dataset.type;
                  this._executePropertyChangeCommand(actionId, characterId, type, '--');
              }
              return;
          }

          // 新增: 处理布局卡片的 "删除" 按钮
          if (e.target.matches('.layout-remove-btn')) {
            this._deleteLayoutAction(card.dataset.id);
            return;
          }
      };

      // 新增: 添加 onchange 事件委托来处理布局卡片属性修改
      timeline.onchange = (e) => {
        const card = e.target.closest('.layout-item');
        if (card && e.target.matches('select, input')) {
            this._updateLayoutActionProperty(card.dataset.id, e.target);
        }
      };
      
    } catch (error) {
      ui.showStatus(`加载编辑器失败: ${error.response?.data?.error || error.message}`, "error");
    }
  },

  /**
   * 按需显示指定卡片的动作/表情设置UI。
   * @param {HTMLElement} cardElement - 被点击卡片的DOM元素。
   */
  showExpressionSetupUI(cardElement) {
    const actionId = cardElement.dataset.id;
    const action = this.projectFileState.actions.find(a => a.id === actionId);
    if (!action) return;

    const footer = cardElement.querySelector('.timeline-item-footer');
    if (!footer) return;

    // 渲染状态栏UI
    const statusBar = this._renderStatusBarForAction(action);
    
    // 清空footer（移除按钮）并添加状态栏
    footer.innerHTML = '';
    footer.appendChild(statusBar);

    // 关键：为新生成的放置区初始化拖拽功能
    this._initSortableForZones(statusBar);
  },

  /**
   * 检查一个action是否已经包含了动作/表情数据。
   * @param {object} action - 项目文件中的action对象。
   * @returns {boolean} - 如果有数据则返回true。
   */
  _actionHasExpressionData(action) {
    if (action.type === 'talk') {
        return action.characterStates && Object.keys(action.characterStates).length > 0;
    }
    if (action.type === 'layout') {
        return action.initialState && Object.keys(action.initialState).length > 0;
    }
    return false;
  },

  /**
   * 为指定的DOM元素内的所有放置区初始化SortableJS。
   * @param {HTMLElement} parentElement - 包含.drop-zone的父元素。
   */
  _initSortableForZones(parentElement) {
    parentElement.querySelectorAll('.drop-zone').forEach(zone => {
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

  /**
   * 渲染左侧的时间线（重构后）。
   */
  renderTimeline() {
    const timeline = document.getElementById("expressionEditorTimeline");
    const talkTemplate = document.getElementById("timeline-talk-card-template");
    const layoutTemplate = document.getElementById("timeline-layout-card-template");
    
    timeline.innerHTML = "";
    
    const fragment = document.createDocumentFragment();

    this.projectFileState.actions.forEach(action => {
      let card;
      // Step 1: 渲染卡片基础内容 (与之前相同)
      if (action.type === 'talk') {
        // ... (talk卡片渲染逻辑保持不变)
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
        // ... (layout卡片渲染逻辑保持不变)
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
      
      // Step 2: 动态决定是显示按钮还是状态栏
      const footer = card.querySelector('.timeline-item-footer');
      if (this._actionHasExpressionData(action)) {
          // 如果已有数据，直接渲染状态栏
          const statusBar = this._renderStatusBarForAction(action);
          footer.appendChild(statusBar);
          // 为这些已存在状态栏的放置区初始化拖拽
          this._initSortableForZones(statusBar);
      } else {
          // 否则，渲染按钮
          const setupButton = document.createElement('button');
          setupButton.className = 'btn btn-secondary btn-sm setup-expressions-btn';
          setupButton.textContent = '设置动作/表情';
          footer.appendChild(setupButton);
      }

      fragment.appendChild(card);
    });
    timeline.appendChild(fragment);
  },

  /**
   * 新的辅助函数：只负责渲染状态栏的DOM，并返回它。
   * @param {object} action - 包含角色状态数据的action对象。
   * @returns {HTMLElement} - 渲染好的 character-status-bar 元素。
   */
  _renderStatusBarForAction(action) {
    const statusTagTemplate = document.getElementById("character-status-tag-template");
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
      } else if (action.type === 'layout' && action.characterId === char.id && action.initialState) {
          currentMotion = action.initialState.motion || '--';
          currentExpression = action.initialState.expression || '--';
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
    return statusBar;
  },

  renderLibraries() {
    this._renderLibrary('motion', motionManager.getAvailableItems());
    this._renderLibrary('expression', expressionManager.getAvailableItems());
    // 为资源库初始化拖拽（只需一次）
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
              // 每次执行/重做后都完全重新渲染时间线
              this.renderTimeline();
          },
          undo: () => {
              this.projectFileState = JSON.parse(beforeState);
              // 每次撤销后也完全重新渲染时间线
              this.renderTimeline();
          }
      };
      historyManager.do(command);
  },

  // 新增: 删除布局卡片的函数
  _deleteLayoutAction(actionId) {
      this._executeCommand((currentState) => {
          currentState.actions = currentState.actions.filter(a => a.id !== actionId);
      });
  },

  // 新增: 修改布局卡片属性的函数
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
  }
};