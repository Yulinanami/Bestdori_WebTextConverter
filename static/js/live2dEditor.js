import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";
import { positionManager } from "./positionManager.js";
import { costumeManager } from "./costumeManager.js";

export const live2dEditor = {
  projectFileState: null,
  
  init() {
    document.getElementById("openLive2dEditorBtn")?.addEventListener("click", () => this.open());
  },

  open() {
    if (!state.get('projectFile')) {
      ui.showStatus("请先在说话人编辑模式中处理文本。", "error");
      return;
    }
    
    this.projectFileState = JSON.parse(JSON.stringify(state.get('projectFile')));

    ui.openModal("live2dEditorModal");
    
    this.renderTimeline();
    this.renderCharacterList();
    
    // --- 1. 在 open 的最后调用 initDragAndDrop ---
    this.initDragAndDrop();
  },

  initDragAndDrop() {
    const characterList = document.getElementById('live2dEditorCharacterList');
    const timeline = document.getElementById('live2dEditorTimeline');

    // 初始化右侧角色列表 (源)
    new Sortable(characterList, {
      group: {
        name: 'live2d-characters',
        pull: 'clone',
        put: false
      },
      sort: false,
    });

    // 初始化左侧时间线 (目标)
    new Sortable(timeline, {
      group: 'live2d-characters',
      animation: 150,
      
      // 核心事件：当角色被拖入时
      onAdd: (evt) => {
        const characterItem = evt.item; // 被拖动的角色元素
        const insertAtIndex = evt.newDraggableIndex; // 角色被放置的索引位置
        
        const characterId = parseInt(characterItem.dataset.characterId);
        
        // 调用我们的核心插入函数
        this.insertLayoutAction(characterId, insertAtIndex);

        // SortableJS 会留下一个克隆的DOM，必须移除它
        characterItem.remove();
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