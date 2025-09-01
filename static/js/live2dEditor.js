import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";
import { positionManager } from "./positionManager.js";
import { costumeManager } from "./costumeManager.js";
import { historyManager } from "./historyManager.js";

export const live2dEditor = {
  projectFileState: null,
  originalStateOnOpen: null,
  
  init() {
    document.getElementById("openLive2dEditorBtn")?.addEventListener("click", () => this.open());
    
    document.getElementById("live2dUndoBtn")?.addEventListener("click", () => historyManager.undo());
    document.getElementById("live2dRedoBtn")?.addEventListener("click", () => historyManager.redo());

    document.addEventListener('historychange', (e) => {
        if (document.getElementById('live2dEditorModal').style.display === 'flex') {
            document.getElementById('live2dUndoBtn').disabled = !e.detail.canUndo;
            document.getElementById('live2dRedoBtn').disabled = !e.detail.canRedo;
        }
    });

    // --- 核心修正 1: 为模态框添加键盘快捷键监听 ---
    const modal = document.getElementById('live2dEditorModal');
    modal?.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                e.preventDefault();
                historyManager.undo();
            } else if (e.key === 'y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
                e.preventDefault();
                historyManager.redo();
            }
        }
    });
    // --- 修正结束 ---

    // TODO: 添加保存、取消等按钮的事件绑定
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

        // 直接修改传入的状态
        if (controlClassName.includes('layout-type-select')) action.layoutType = value;
        else if (controlClassName.includes('layout-costume-select')) action.costume = value;
        else if (controlClassName.includes('layout-position-select')) {
            action.position.from.side = value;
            action.position.to.side = value;
        } else if (controlClassName.includes('layout-offset-input')) {
            action.position.from.offsetX = value;
            action.position.to.offsetX = value;
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
            this.insertLayoutAction(characterId, insertAtIndex);
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
  insertLayoutAction(characterId, index) {
    // a. 获取默认配置
    const defaultCostume = this._getDefaultCostume(characterId);
    const defaultPosition = this._getDefaultPosition(characterId);

    // b. 创建新的 layout action 对象
    const newLayoutAction = {
      id: `layout-action-${Date.now()}`,
      type: "layout",
      characterId: characterId,
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

  _getDefaultCostume(characterId) {
    const characterName = configManager.getCharacterNameById(characterId);
    // 从 costumeManager 维护的状态中获取
    return state.get('currentCostumes')[characterName] || "";
  },

  _getDefaultPosition(characterId) {
    const characterName = configManager.getCharacterNameById(characterId);
    // 注意：这里的 getCharacterPositionConfig 需要角色的出场顺序才能正确计算自动位置。
    // 在这个简化的版本中，我们暂时忽略出场顺序，直接读取手动配置，
    // 或者总是返回一个默认值。更复杂的逻辑将在“一键布局”中实现。
    
    // 简化逻辑：优先读取手动配置，否则返回默认中心位置
    if (!positionManager.autoPositionMode && positionManager.manualPositions[characterName]) {
      return {
        position: positionManager.manualPositions[characterName].position || 'center',
        offset: positionManager.manualPositions[characterName].offset || 0
      };
    }
    // 默认返回中心位置
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
        const characterName = configManager.getCharacterNameById(characterId);
        
        card.querySelector('.speaker-name').textContent = characterName || `未知角色 (ID: ${characterId})`;
        const avatarDiv = card.querySelector('.dialogue-avatar');
        configManager.updateConfigAvatar({ querySelector: () => avatarDiv }, characterId, characterName);
        
        // --- 核心修正：填充下拉菜单和设置值 ---
        
        // 1. 设置 Type, Position, Offset 的当前值
        const typeSelect = card.querySelector('.layout-type-select');
        typeSelect.value = action.layoutType;
        
        const positionSelect = card.querySelector('.layout-position-select');
        const offsetInput = card.querySelector('.layout-offset-input');
        
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
        Object.entries(positionManager.positionNames).forEach(([value, name]) => {
            const option = new Option(name, value);
            positionSelect.add(option);
        });
        positionSelect.value = currentPosition;
        offsetInput.value = currentOffset;

        // --- 修正结束 ---
        
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