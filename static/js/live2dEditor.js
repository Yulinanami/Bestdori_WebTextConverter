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
    
    // --- 2. 绑定撤销/重做按钮和历史更新事件 ---
    document.getElementById("live2dUndoBtn")?.addEventListener("click", () => historyManager.undo());
    document.getElementById("live2dRedoBtn")?.addEventListener("click", () => historyManager.redo());

    document.addEventListener('historychange', (e) => {
        // 确保只在live2d编辑器打开时更新其按钮
        if (document.getElementById('live2dEditorModal').style.display === 'flex') {
            document.getElementById('live2dUndoBtn').disabled = !e.detail.canUndo;
            document.getElementById('live2dRedoBtn').disabled = !e.detail.canRedo;
        }
    });

    // TODO: 添加保存、取消等按钮的事件绑定
  },

  open() {
    if (!state.get('projectFile')) {
      ui.showStatus("请先在说话人编辑模式中处理文本。", "error");
      return;
    }
    
    this.projectFileState = JSON.parse(JSON.stringify(state.get('projectFile')));
    this.originalStateOnOpen = JSON.stringify(this.projectFileState);

    historyManager.clear(); // 每次打开都清空历史

    ui.openModal("live2dEditorModal");
    
    this.renderTimeline();
    this.renderCharacterList();
    this.initDragAndDrop();

    // --- 3. 添加事件委托 ---
    const timeline = document.getElementById('live2dEditorTimeline');
    timeline.addEventListener('change', this._handleTimelineEvent.bind(this));
    timeline.addEventListener('input', this._handleTimelineEvent.bind(this));
    timeline.addEventListener('click', this._handleTimelineEvent.bind(this));
  },

  /**
   * --- 4. 新增：事件委托处理器 ---
   * 处理时间线内所有子元素的事件。
   */
  _handleTimelineEvent(e) {
    const target = e.target;
    const card = target.closest('.layout-item');
    if (!card) return;

    const actionId = card.dataset.id;
    const property = target.dataset.property; // 我们需要在模板中为控件添加 data-property

    if (target.matches('.layout-remove-btn')) {
        this._deleteLayoutAction(actionId);
    } else if (target.matches('.layout-type-select, .layout-costume-select, .layout-position-select, .layout-offset-input')) {
        const value = target.type === 'number' ? parseInt(target.value) || 0 : target.value;
        this._updateLayoutActionProperty(actionId, target.className, value);
    }
  },

   _updateLayoutActionProperty(actionId, controlClassName, value) {
    // --- 1. 捕获操作前的状态，以供撤销 ---
    const oldState = JSON.stringify(this.projectFileState);
    
    let needsFullRender = false; // 标记是否需要完全重绘

    // --- 2. 创建命令对象 ---
    const command = {
        execute: () => {
            const action = this.projectFileState.actions.find(a => a.id === actionId);
            if (!action) return;

            // --- 3. 分情况处理数据更新和UI重绘 ---
            if (controlClassName.includes('layout-type-select')) {
                // 如果改变了类型，需要重绘UI以显示/隐藏相关控件
                if (action.layoutType !== value) { // 仅当值真正改变时才视为变更
                    action.layoutType = value;
                    needsFullRender = true; // 标记需要重绘
                }
            } else if (controlClassName.includes('layout-costume-select')) {
                action.costume = value;
                // 仅更新数据，不重绘（或局部更新）
            } else if (controlClassName.includes('layout-position-select')) {
                action.position.from.side = value;
                action.position.to.side = value;
            } else if (controlClassName.includes('layout-offset-input')) {
                action.position.from.offsetX = parseInt(value) || 0;
                action.position.to.offsetX = parseInt(value) || 0;
            }
            
            // --- 4. 根据是否需要重绘来执行操作 ---
            if (needsFullRender) {
                this.renderTimeline(); // 只在类型改变时完全重绘
            }
        },
        undo: () => {
            // 撤销时，总是需要完全重绘以确保状态一致
            this.projectFileState = JSON.parse(oldState);
            this.renderTimeline();
        }
    };
    
    historyManager.do(command);
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
      // 删除操作会改变DOM结构，所以它保持原样是正确的
      const oldState = JSON.stringify(this.projectFileState);
      const command = {
          execute: () => {
              this.projectFileState.actions = this.projectFileState.actions.filter(a => a.id !== actionId);
              this.renderTimeline();
          },
          undo: () => {
              this.projectFileState = JSON.parse(oldState);
              this.renderTimeline();
          }
      };
      historyManager.do(command);
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
      
      onEnd: (evt) => {
          // TODO: 在这里添加排序的撤销/重做逻辑 (与 speakerEditor 类似)
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