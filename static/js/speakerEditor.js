import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";

export const speakerEditor = {
  // 用于存储当前模态框内的项目文件状态
  projectFileState: null,
  
  /**
   * 初始化模块，绑定打开按钮的事件监听器。
   */
  init() {
    const openBtn = document.getElementById("openSpeakerEditorBtn");
    if (openBtn) {
      openBtn.addEventListener("click", () => this.open());
    }
  },

  /**
   * 打开编辑器模态框，加载并初始化所有数据和交互。
   */
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

      // 2. 根据分段创建并预处理项目文件状态
      this.projectFileState = this.createProjectFileFromSegments(segments);
      
      // 3. 渲染静态UI
      this.renderCanvas();
      this.renderCharacterList();

      // 4. 初始化拖拽功能
      this.initDragAndDrop();

    } catch (error) {
      ui.showStatus(`加载编辑器失败: ${error.response?.data?.error || error.message}`, "error");
      ui.closeModal("speakerEditorModal");
    }
  },

  /**
   * 根据分段文本数组创建初始的项目文件对象。
   * 此函数会进行一次智能预处理，自动识别并清理符合 "角色名：" 格式的文本。
   * @param {string[]} segments - 从后端获取的文本片段数组。
   * @returns {object} - 初始化后的项目文件状态对象。
   */
  createProjectFileFromSegments(segments) {
    const characterMap = new Map(Object.entries(state.get("currentConfig")).map(([name, ids]) => [name, { characterId: ids[0], name: name }]));

    const newProjectFile = {
      version: "1.0",
      actions: segments.map((text, index) => {
        let speakers = [];
        let cleanText = text;

        const match = text.match(/^(.*?)\s*[：:]\s*(.*)$/s);
        if (match) {
            const potentialSpeakerName = match[1].trim();
            if (characterMap.has(potentialSpeakerName)) {
                speakers.push(characterMap.get(potentialSpeakerName));
                cleanText = match[2].trim();
            }
        }
        
        return {
          id: `action-id-${Date.now()}-${index}`,
          type: "talk",
          text: cleanText,
          speakers: speakers,
          characterStates: {}
        };
      })
    };
    return newProjectFile;
  },

  /**
   * 渲染左侧的文本片段卡片画布。
   * UI会根据每个action的speakers数组动态变化。
   */
  renderCanvas() {
    const canvas = document.getElementById("speakerEditorCanvas");
    const template = document.getElementById("text-snippet-card-template");
    const scrollState = canvas.scrollTop; // 保存滚动位置
    canvas.innerHTML = "";
    
    requestAnimationFrame(() => {
        const fragment = document.createDocumentFragment();
        this.projectFileState.actions.forEach(action => {
            if (action.type !== 'talk') return;

            const card = template.content.cloneNode(true);
            const dialogueItem = card.querySelector(".dialogue-item");
            dialogueItem.dataset.id = action.id;

            const avatarContainer = card.querySelector(".speaker-avatar-container");
            const avatarDiv = card.querySelector(".dialogue-avatar");
            const speakerNameDiv = card.querySelector(".speaker-name");
            const multiSpeakerBadge = card.querySelector(".multi-speaker-badge");

            if (action.speakers && action.speakers.length > 0) {
                const firstSpeaker = action.speakers[0];
                
                avatarContainer.style.display = "flex";
                speakerNameDiv.style.display = "block";
                dialogueItem.classList.remove('narrator');
                
                configManager.updateConfigAvatar({ querySelector: () => avatarDiv }, firstSpeaker.characterId, firstSpeaker.name);
                speakerNameDiv.textContent = action.speakers.map(s => s.name).join(' & ');

                if (action.speakers.length > 1) {
                    multiSpeakerBadge.style.display = "flex";
                    multiSpeakerBadge.textContent = `+${action.speakers.length - 1}`;
                    avatarContainer.style.cursor = "pointer";
                    avatarContainer.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.showMultiSpeakerPopover(action.id, avatarContainer);
                    });
                } else {
                    multiSpeakerBadge.style.display = "none";
                    avatarContainer.style.cursor = "default";
                }
            } else {
                avatarContainer.style.display = "none";
                speakerNameDiv.style.display = "none";
                multiSpeakerBadge.style.display = "none";
                dialogueItem.classList.add('narrator');
            }
            
            card.querySelector(".dialogue-text").textContent = action.text;
            fragment.appendChild(card);
        });
        canvas.appendChild(fragment);
        canvas.scrollTop = scrollState; // 恢复滚动位置
    });
  },

  /**
   * 渲染右侧的可拖拽角色列表。
   */
  renderCharacterList() {
    // ... (此函数无需修改，保持原样)
    const listContainer = document.getElementById("speakerEditorCharacterList");
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
  },

  /**
   * 初始化SortableJS，实现双向拖拽功能。
   */
  initDragAndDrop() {
    const characterList = document.getElementById('speakerEditorCharacterList');
    const canvas = document.getElementById('speakerEditorCanvas');

    new Sortable(characterList, {
      group: {
        name: 'shared-speakers',
        pull: 'clone',
        put: true
      },
      sort: false,
      onAdd: (evt) => {
          const cardItem = evt.item;
          const actionId = cardItem.dataset.id;
          if (actionId) {
            this.removeAllSpeakersFromAction(actionId);
          }
          cardItem.remove();
      }
    });

    new Sortable(canvas, {
      group: 'shared-speakers',
      sort: false,
      animation: 150,
      onAdd: (evt) => {
        const characterItem = evt.item; // 被拖拽的角色元素

        // --- BUG FIX V2 (ROBUST VERSION) START ---
        // 1. 临时隐藏被拖拽的元素，这样它就不会干扰我们寻找它下方的元素
        characterItem.style.display = 'none';
        
        // 2. 使用鼠标坐标精确获取指针下方的元素
        const dropTargetElement = document.elementFromPoint(evt.originalEvent.clientX, evt.originalEvent.clientY);

        // 3. 现在可以安全地找到目标卡片了
        const targetCard = dropTargetElement ? dropTargetElement.closest('.dialogue-item') : null;
        // --- BUG FIX V2 END ---

        if (!targetCard) {
            characterItem.remove(); // 清理
            return;
        }

        const characterId = parseInt(characterItem.dataset.characterId);
        const characterName = characterItem.dataset.characterName;
        const actionId = targetCard.dataset.id;

        if (characterId && actionId) {
            this.updateSpeakerAssignment(actionId, { characterId, name: characterName });
        }
        
        characterItem.remove();
      }
    });
  },

  // ... (其余所有函数，如 updateSpeakerAssignment, removeSpeakerFromAction 等，保持不变)
  updateSpeakerAssignment(actionId, newSpeaker) {
    const actionToUpdate = this.projectFileState.actions.find(a => a.id === actionId);
    if (!actionToUpdate) return;
    
    const speakerExists = actionToUpdate.speakers.some(s => s.characterId === newSpeaker.characterId);
    if (!speakerExists) {
        actionToUpdate.speakers.push(newSpeaker);
        this.renderCanvas();
    } else {
        ui.showStatus("该角色已经是说话人。", "info");
    }
  },

  removeSpeakerFromAction(actionId, characterIdToRemove) {
      const action = this.projectFileState.actions.find(a => a.id === actionId);
      if (action) {
          action.speakers = action.speakers.filter(s => s.characterId !== characterIdToRemove);
          this.renderCanvas();
      }
  },

  removeAllSpeakersFromAction(actionId) {
      const action = this.projectFileState.actions.find(a => a.id === actionId);
      if (action) {
          action.speakers = [];
          this.renderCanvas();
      }
  },

  showMultiSpeakerPopover(actionId, targetElement) {
    // ... (此函数无需修改，保持原样)
    const existingPopover = document.getElementById('speaker-popover');
    if (existingPopover) existingPopover.remove();

    const action = this.projectFileState.actions.find(a => a.id === actionId);
    if (!action) return;

    const popover = document.createElement('div');
    popover.id = 'speaker-popover';
    popover.style.cssText = `
        position: fixed;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        z-index: 10001;
        padding: 8px;
        min-width: 150px;
    `;
    
    action.speakers.forEach(speaker => {
        const item = document.createElement('div');
        item.style.cssText = `display: flex; align-items: center; padding: 6px 8px; border-radius: 5px;`;
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = speaker.name;
        nameSpan.style.flexGrow = '1';

        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.style.cssText = `
            border: none; background: #f1f5f9; color: #64748b; border-radius: 50%;
            width: 22px; height: 22px; cursor: pointer; margin-left: 10px;
            display: flex; align-items: center; justify-content: center; font-size: 16px; line-height: 1;
            transition: all 0.2s ease;
        `;
        deleteBtn.onmouseover = () => { deleteBtn.style.background = '#fee2e2'; deleteBtn.style.color = '#ef4444'; };
        deleteBtn.onmouseout = () => { deleteBtn.style.background = '#f1f5f9'; deleteBtn.style.color = '#64748b'; };

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeSpeakerFromAction(actionId, speaker.characterId);
            popover.remove();
        });

        item.appendChild(nameSpan);
        item.appendChild(deleteBtn);
        popover.appendChild(item);
    });

    document.body.appendChild(popover);
    const rect = targetElement.getBoundingClientRect();
    popover.style.top = `${rect.bottom + 5}px`;
    popover.style.left = `${rect.left}px`;

    setTimeout(() => {
        document.addEventListener('click', function onClickOutside(e) {
            if (!popover.contains(e.target)) {
                popover.remove();
                document.removeEventListener('click', onClickOutside);
            }
        }, { once: true });
    }, 0);
  }
};