import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";
import { positionManager } from "./positionManager.js";
import { costumeManager } from "./costumeManager.js";
import { historyManager } from "./historyManager.js";
import { projectManager } from "./projectManager.js"; // 导入项目管理器

export const live2dEditor = {
  projectFileState: null,
  originalStateOnOpen: null,
  
  init() {
    // 1. 绑定功能按钮
    document.getElementById("openLive2dEditorBtn")?.addEventListener("click", () => this.open());
    document.getElementById("autoLayoutBtn")?.addEventListener("click", () => this._applyAutoLayout());
    document.getElementById("resetLayoutsBtn")?.addEventListener("click", () => this._clearAllLayouts());
    document.getElementById("live2dUndoBtn")?.addEventListener("click", () => historyManager.undo());
    document.getElementById("live2dRedoBtn")?.addEventListener("click", () => historyManager.redo());
    
    // --- 核心修正 1: 绑定项目管理按钮 ---
    document.getElementById("saveLayoutsBtn")?.addEventListener("click", () => this.save());
    // (导入/导出功能可以后续添加，暂时注释)
    document.getElementById("importLayoutsBtn")?.addEventListener("click", () => this.importProject());
    document.getElementById("exportLayoutsBtn")?.addEventListener("click", () => this.exportProject());

    // 2. 统一处理关闭事件
    const modal = document.getElementById('live2dEditorModal');
    const handleCloseAttempt = (e) => {
        if (JSON.stringify(this.projectFileState) !== this.originalStateOnOpen) {
             if (!confirm("您有未保存的更改，确定要关闭吗？")) {
                e.stopPropagation();
                e.preventDefault();
                return;
             }
        }
        this._closeEditor();
    };
    modal?.querySelector('.btn-modal-close')?.addEventListener('click', handleCloseAttempt, true);
    modal?.querySelector('.modal-close')?.addEventListener('click', handleCloseAttempt, true);

    // 3. 监听历史变化
    document.addEventListener('historychange', (e) => {
        if (document.getElementById('live2dEditorModal').style.display === 'flex') {
            document.getElementById('live2dUndoBtn').disabled = !e.detail.canUndo;
            document.getElementById('live2dRedoBtn').disabled = !e.detail.canRedo;
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

  open() {
    if (!state.get('projectFile')) {
      ui.showStatus("请先在说话人编辑模式中处理文本。", "error");
      return;
    }
    
    this.projectFileState = JSON.parse(JSON.stringify(state.get('projectFile')));
    this.originalStateOnOpen = JSON.stringify(this.projectFileState);

    historyManager.clear();

    ui.openModal("live2dEditorModal");
    
    // --- 核心修正 2: 打开后立即设置焦点 ---
    const modal = document.getElementById('live2dEditorModal');
    if (modal) {
        modal.focus();
    }
    // --- 修正结束 ---

    this.renderTimeline();
    this.renderCharacterList();
    this.initDragAndDrop();

    const timeline = document.getElementById('live2dEditorTimeline');
    timeline.addEventListener('change', this._handleTimelineEvent.bind(this));
    timeline.addEventListener('click', (e) => {
        if (e.target.matches('.layout-remove-btn')) {
            const card = e.target.closest('.layout-item');
            if (card && card.dataset.id) {
                this._deleteLayoutAction(card.dataset.id);
            }
        }
    });
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
          this.renderTimeline();
      }
  },

  _closeEditor() {
    // TODO: 如果未来Live2D编辑器也需要多选，在这里detach
    ui.closeModal("live2dEditorModal");
  },

_applyAutoLayout() {
      if (!confirm("这将清空所有现有的Live2D布局，并根据角色的首次发言自动生成新的登场布局。确定要继续吗？")) {
          return;
      }

      this._executeCommand((currentState) => {
          // a. 首先，移除所有现有的 layout 动作
          currentState.actions = currentState.actions.filter(a => a.type !== 'layout');

          const appearedCharacterNames = new Set();
          const newActions = [];

          // b. 遍历所有动作，寻找角色首次发言并插入登场布局
          currentState.actions.forEach(action => {
              if (action.type === 'talk' && action.speakers.length > 0) {
                  action.speakers.forEach(speaker => {
                      if (!appearedCharacterNames.has(speaker.name)) {
                          appearedCharacterNames.add(speaker.name);
                          
                          // 插入一个新的登场布局动作
                          const defaultCostume = this._getDefaultCostume(speaker.name);
                          // 使用 positionManager 来获取自动位置
                          const positionConfig = positionManager.getCharacterPositionConfig(speaker.name, appearedCharacterNames.size - 1);

                          const newLayoutAction = {
                            id: `layout-action-${Date.now()}-${speaker.characterId}`,
                            type: "layout",
                            characterId: speaker.characterId,
                            characterName: speaker.name,
                            layoutType: "appear",
                            costume: defaultCostume,
                            position: {
                              from: { side: positionConfig.position, offsetX: positionConfig.offset },
                              to: { side: positionConfig.position, offsetX: positionConfig.offset }
                            },
                            initialState: {}
                          };
                          newActions.push(newLayoutAction);
                      }
                  });
              }
              newActions.push(action);
          });
          
          currentState.actions = newActions;
      });
      ui.showStatus("已应用智能布局！", "success");
  },

  _clearAllLayouts() {
      // "清空布局" 实际上就是一种特殊的 "恢复默认"
      projectManager.reset(() => {
          // 定义获取默认状态的函数：即过滤掉所有layout action
          const newState = JSON.parse(JSON.stringify(this.projectFileState));
          newState.actions = newState.actions.filter(a => a.type !== 'layout');
          return newState;
      }, (newState) => {
          this.projectFileState = newState;
          this.originalStateOnOpen = JSON.stringify(newState);
          historyManager.clear();
          this.renderTimeline();
      });
  },
  /**
   * --- 4. 新增：事件委托处理器 ---
   * 处理时间线内所有子元素的事件。
   */
  _handleTimelineEvent(e) {
    const target = e.target;
    const card = target.closest('.layout-item');
    if (!card || !card.dataset.id) return;
    
    // 现在只处理表单控件的 change 事件
    if (target.matches('select, input')) {
        const actionId = card.dataset.id;
        const value = target.type === 'number' ? parseInt(target.value) || 0 : target.value;
        this._updateLayoutActionProperty(actionId, target.className, value);
    }
  },

   _updateLayoutActionProperty(actionId, controlClassName, value) {
      this._executeCommand((currentState) => {
        const action = currentState.actions.find(a => a.id === actionId);
        if (!action) return;
        
        // --- 4. 增强：处理 move 类型的双位置 ---
        if (controlClassName.includes('layout-position-select-to')) {
            action.position.to.side = value;
        } else if (controlClassName.includes('layout-offset-input-to')) {
            action.position.to.offsetX = parseInt(value) || 0;
        } 
        // 旧的逻辑保持不变
        else if (controlClassName.includes('layout-type-select')) action.layoutType = value;
        else if (controlClassName.includes('layout-costume-select')) action.costume = value;
        else if (controlClassName.includes('layout-position-select')) {
            action.position.from.side = value;
            if (action.layoutType !== 'move') action.position.to.side = value; // 非move时保持同步
        } else if (controlClassName.includes('layout-offset-input')) {
            action.position.from.offsetX = parseInt(value) || 0;
            if (action.layoutType !== 'move') action.position.to.offsetX = parseInt(value) || 0; // 非move时保持同步
        }
      });
  },

  /**
   * --- 5. 新增：更新 layout action 的逻辑（包装成命令） ---
   */
  _updateLayoutAction(actionId, controlClassName, value) {
    const oldState = JSON.stringify(this.projectFileState);

    const command = {
        execute: () => {
            const action = this.projectFileState.actions.find(a => a.id === actionId);
            if (!action) return;

            // 根据控件的类名来决定更新哪个属性
            if (controlClassName.includes('layout-type-select')) {
                action.layoutType = value;
            } else if (controlClassName.includes('layout-costume-select')) {
                action.costume = value;
            } else if (controlClassName.includes('layout-position-select')) {
                action.position.from.side = value;
                action.position.to.side = value; // 简化：暂时保持同步
            } else if (controlClassName.includes('layout-offset-input')) {
                action.position.from.offsetX = value;
                action.position.to.offsetX = value; // 简化：暂时保持同步
            }
            this.renderTimeline();
        },
        undo: () => {
            this.projectFileState = JSON.parse(oldState);
            this.renderTimeline();
        }
    };
    historyManager.do(command);
  },
  
  /**
   * --- 6. 新增：删除 layout action 的逻辑（包装成命令） ---
   */
   _deleteLayoutAction(actionId) {
      this._executeCommand((currentState) => {
          currentState.actions = currentState.actions.filter(a => a.id !== actionId);
      });
  },

  initDragAndDrop() {
    const characterList = document.getElementById('live2dEditorCharacterList');
    const timeline = document.getElementById('live2dEditorTimeline');

    // --- 核心修正 1: 修改右侧角色列表的 Sortable 配置 ---
    new Sortable(characterList, {
      group: {
        name: 'live2d-shared', // 统一组名
        pull: 'clone',
        put: true // 允许从左侧拖入
      },
      sort: false,
      // 新增 onAdd 事件处理器来处理删除逻辑
      onAdd: (evt) => {
        const item = evt.item; // 被拖入的元素
        // 检查它是否是一个布局卡片 (通过 class 或 data-id)
        if (item.classList.contains('layout-item') && item.dataset.id) {
            this._deleteLayoutAction(item.dataset.id);
        }
        // 无论如何，都移除这个临时DOM元素
        item.remove();
      }
    });

    // --- 核心修正 2: 修改左侧时间线的 Sortable 配置 ---
    new Sortable(timeline, {
      group: 'live2d-shared', // 统一组名
      animation: 150,
      sort: true, // 允许排序
      
      // --- 核心修正 3: 为排序实现撤销/重做 ---
      onEnd: (evt) => {
        if (evt.from === evt.to && evt.oldIndex !== evt.newIndex) {
                const { oldIndex, newIndex } = evt;
                this._executeCommand((currentState) => {
                    const [movedItem] = currentState.actions.splice(oldIndex, 1);
                    currentState.actions.splice(newIndex, 0, movedItem);
                });
            }
      },

      onAdd: (evt) => {
        const characterItem = evt.item;
        const insertAtIndex = evt.newDraggableIndex;
        
        // 检查是否是从角色列表拖来的
        if (characterItem.classList.contains('character-item')) {
                const characterId = parseInt(characterItem.dataset.characterId);
                // --- 5. 拖拽时同时获取 characterName ---
                const characterName = characterItem.dataset.characterName;
                this.insertLayoutAction(characterId, characterName, insertAtIndex);
                characterItem.remove();
            }
      }
    });
  },

  /**
   * --- 3. 新增：核心插入逻辑 ---
   * 在指定索引处插入一个新的 layout 动作。
   * @param {number} characterId - 要添加的角色的ID。
   * @param {number} index - 要插入到 actions 数组中的索引。
   */
  insertLayoutAction(characterId, characterName, index) {
    // a. 获取默认配置
    const defaultCostume = this._getDefaultCostume(characterName); // 使用 name
    const defaultPosition = this._getDefaultPosition(characterName); // 使用 name

    // b. 创建新的 layout action 对象
    const newLayoutAction = {
      id: `layout-action-${Date.now()}`,
      type: "layout",
      characterId: characterId,
      characterName: characterName,
      layoutType: "appear", // 默认是登场
      costume: defaultCostume,
      position: {
        from: {
          side: defaultPosition.position,
          offsetX: defaultPosition.offset
        },
        to: { // 对于 appear，from 和 to 相同
          side: defaultPosition.position,
          offsetX: defaultPosition.offset
        }
      },
      initialState: {
        motion: "",
        expression: ""
      }
    };
    
    // c. 将新对象插入到 projectFileState 的 actions 数组中
    this.projectFileState.actions.splice(index, 0, newLayoutAction);
    
    // d. 重新渲染整个时间线以反映变化
    this.renderTimeline();
  },

  /**
   * --- 核心修正：重构命令创建逻辑以支持完整的重做功能 ---
   * 创建一个命令对象，捕获操作前后的完整状态。
   * @param {function} executeFn - 一个执行修改的函数，它接收 currentState 并返回 newState。
   */
  _executeCommand(changeFn) {
      const beforeState = JSON.stringify(this.projectFileState);

      // 执行操作来计算出操作后的状态
      // 我们在一个临时的深拷贝上执行，以避免直接修改当前状态
      const tempState = JSON.parse(beforeState);
      changeFn(tempState);
      const afterState = JSON.stringify(tempState);

      // 如果操作没有导致任何变化，则不记录历史
      if (beforeState === afterState) {
          return;
      }
      
      const command = {
          execute: () => {
              // 重做就是恢复到操作后的状态
              this.projectFileState = JSON.parse(afterState);
              this.renderTimeline();
          },
          undo: () => {
              // 撤销就是恢复到操作前的状态
              this.projectFileState = JSON.parse(beforeState);
              this.renderTimeline();
          }
      };
      
      // 使用 historyManager.do 来执行第一次操作并记录
      historyManager.do(command);
  },

  _getDefaultCostume(characterName) { // --- 3. 参数改为 characterName ---
    return state.get('currentCostumes')[characterName] || "";
  },

  _getDefaultPosition(characterName) { // --- 4. 参数改为 characterName ---
    if (!positionManager.autoPositionMode && positionManager.manualPositions[characterName]) {
      return {
        position: positionManager.manualPositions[characterName].position || 'center',
        offset: positionManager.manualPositions[characterName].offset || 0
      };
    }
    return { position: 'center', offset: 0 };
  },

  /**
   * 核心渲染函数：混合渲染对话和布局卡片。
   */
  renderTimeline() {
    const timeline = document.getElementById("live2dEditorTimeline");
    const talkTemplate = document.getElementById("timeline-talk-card-template");
    const layoutTemplate = document.getElementById("timeline-layout-card-template");
    timeline.innerHTML = "";

    const fragment = document.createDocumentFragment();

    this.projectFileState.actions.forEach(action => {
      if (action.type === 'talk') {
        const card = talkTemplate.content.cloneNode(true);
        card.querySelector('.timeline-item').dataset.id = action.id;
        
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
        fragment.appendChild(card);

      } else if (action.type === 'layout') {
        const card = layoutTemplate.content.cloneNode(true);
        const item = card.querySelector('.timeline-item');
        item.dataset.id = action.id;
        item.dataset.layoutType = action.layoutType;

        const characterId = action.characterId;
        const characterName = action.characterName || configManager.getCharacterNameById(characterId);
        
        card.querySelector('.speaker-name').textContent = characterName || `未知角色 (ID: ${characterId})`;
        const avatarDiv = card.querySelector('.dialogue-avatar');
        configManager.updateConfigAvatar({ querySelector: () => avatarDiv }, characterId, characterName);
        
        // --- 核心修正：填充下拉菜单和设置值 ---
        
        // 1. 设置 Type, Position, Offset 的当前值
        const typeSelect = card.querySelector('.layout-type-select');
        typeSelect.value = action.layoutType;
        
        const positionSelect = card.querySelector('.layout-position-select');
        const offsetInput = card.querySelector('.layout-offset-input');
        const toPositionSelect = card.querySelector('.layout-position-select-to'); // 获取终点位置select
        
        // 简化处理：暂时只显示和编辑 "from" 的位置
        // 在下一步实现 move 类型时再扩展
        const currentPosition = action.position?.from?.side || 'center';
        const currentOffset = action.position?.from?.offsetX || 0;

        // 2. 动态填充服装 (Costume) 下拉菜单
        const costumeSelect = card.querySelector('.layout-costume-select');
        costumeSelect.innerHTML = ''; // 清空
        
        // 从 costumeManager 获取该角色的可用服装列表
        const availableCostumes = costumeManager.availableCostumes[characterName] || [];
        availableCostumes.forEach(costumeId => {
            const option = new Option(costumeId, costumeId);
            costumeSelect.add(option);
        });
        // 如果当前服装不在可用列表里 (例如自定义的)，也添加进去
        if (action.costume && !availableCostumes.includes(action.costume)) {
            const option = new Option(`${action.costume} (自定义)`, action.costume);
            costumeSelect.add(option, 0); // 添加到最前面
        }
        costumeSelect.value = action.costume;


        // 3. 动态填充位置 (Position) 下拉菜单
        positionSelect.innerHTML = ''; // 清空
        toPositionSelect.innerHTML = '';
        Object.entries(positionManager.positionNames).forEach(([value, name]) => {
            // 为两个下拉菜单同时创建和添加选项
            const optionFrom = new Option(name, value);
            const optionTo = new Option(name, value);
            positionSelect.add(optionFrom);
            toPositionSelect.add(optionTo);
        });
        positionSelect.value = currentPosition;
        offsetInput.value = currentOffset;

        // --- 5. 增强：根据 layoutType 动态显示/隐藏UI ---
        const toPositionContainer = card.querySelector('.to-position-container');
        if (action.layoutType === 'move') {
            toPositionContainer.style.display = 'grid'; // 或 'flex'
            
            // 填充 "to" 的值
            card.querySelector('.layout-position-select-to').value = action.position?.to?.side || 'center';
            card.querySelector('.layout-offset-input-to').value = action.position?.to?.offsetX || 0;
        } else {
            toPositionContainer.style.display = 'none';
        }

        fragment.appendChild(card);
      }
    });

    timeline.appendChild(fragment);
  },

  /**
   * 渲染右侧的角色列表 (可直接复用 speakerEditor 的逻辑)。
   */
  renderCharacterList() {
    const listContainer = document.getElementById("live2dEditorCharacterList");
    const template = document.getElementById("draggable-character-template");
    listContainer.innerHTML = "";

    const fragment = document.createDocumentFragment();
    const characters = Object.entries(state.get("currentConfig")).sort(
      ([, idsA], [, idsB]) => idsA[0] - idsB[0]
    );

    characters.forEach(([name, ids]) => {
      const item = template.content.cloneNode(true);
      const characterItem = item.querySelector(".character-item");
      characterItem.dataset.characterId = ids[0];
      characterItem.dataset.characterName = name;
      const avatarWrapper = { querySelector: (sel) => item.querySelector(sel) };
      configManager.updateConfigAvatar(avatarWrapper, ids[0], name);
      item.querySelector(".character-name").textContent = name;
      fragment.appendChild(item);
    });
    listContainer.appendChild(fragment);
  }
};