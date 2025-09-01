import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";
import { selectionManager } from "./selectionManager.js";

export const speakerEditor = {
  // 用于存储当前模态框内的项目文件状态
  projectFileState: null,
  // 保存打开时的原始状态，用于比较是否有未保存的修改
  originalStateOnOpen: null,
  scrollInterval: null,
  scrollSpeed: 0,  
  
  /**
   * 初始化模块，绑定所有必要的事件监听器。
   */
  init() {
    const openBtn = document.getElementById("openSpeakerEditorBtn");
    if (openBtn) {
      openBtn.addEventListener("click", () => this.open());
    }

    document.getElementById("saveSpeakersBtn")?.addEventListener("click", () => this.save());
    document.getElementById("exportProjectBtn")?.addEventListener("click", () => this.exportProject());
    document.getElementById("importProjectBtn")?.addEventListener("click", () => this.importProject());
    document.getElementById("resetSpeakersBtn")?.addEventListener("click", () => this.reset());

    const cancelHandler = (e) => {
        if (JSON.stringify(this.projectFileState) !== this.originalStateOnOpen) {
             if (!confirm("您有未保存的更改，确定要关闭吗？")) {
                e.stopPropagation();
                e.preventDefault();
             }
        }
    };
    
    const modal = document.getElementById('speakerEditorModal');
    modal?.querySelector('.btn-modal-close')?.addEventListener('click', cancelHandler, true);
    modal?.querySelector('.modal-close')?.addEventListener('click', cancelHandler, true);
  },

  /**
   * 打开编辑器模态框，加载并初始化所有数据和交互。
   */
  async open() {
    const rawText = document.getElementById("inputText").value;
    if (!rawText.trim() && !state.get('projectFile')) {
      ui.showStatus("请输入文本或导入项目后再打开编辑器。", "error");
      return;
    }

    ui.openModal("speakerEditorModal");

    try {
      let initialState;
      if (state.get('projectFile')) {
        initialState = state.get('projectFile');
        ui.showStatus("已加载现有项目进度。", "info");
      } else {
        const response = await axios.post("/api/segment-text", { text: rawText });
        const segments = response.data.segments;
        initialState = this.createProjectFileFromSegments(segments);
      }
      
      this.projectFileState = JSON.parse(JSON.stringify(initialState));
      this.originalStateOnOpen = JSON.stringify(initialState);
      
      const usedCharacterIds = this.renderCanvas();
      this.renderCharacterList(usedCharacterIds);
      
      this.initDragAndDrop();

        // --- 2. 初始化多选管理器 ---
        const canvas = document.getElementById('speakerEditorCanvas');
        selectionManager.clear(); // 每次打开都清空选项
        selectionManager.init(canvas, '.dialogue-item');

        // --- 3. 监听选项变化事件以更新UI ---
        canvas.addEventListener('selectionchange', (e) => {
            const selectedIds = new Set(e.detail.selectedIds);
            const allCards = canvas.querySelectorAll('.dialogue-item');
            allCards.forEach(card => {
                if (selectedIds.has(card.dataset.id)) {
                    card.classList.add('is-selected');
                } else {
                    card.classList.remove('is-selected');
                }
            });
        });      

    } catch (error) {
      ui.showStatus(`加载编辑器失败: ${error.response?.data?.error || error.message}`, "error");
      ui.closeModal("speakerEditorModal");
    }
  },

  /**
   * 根据分段文本数组创建初始的项目文件对象，并进行自动识别。
   * @param {string[]} segments - 文本片段数组。
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
   * 渲染左侧的文本片段卡片画布，并返回已使用的角色ID集合。
   * @returns {Set<number>} 一个包含所有已使用角色ID的Set集合。
   */
  renderCanvas() {
    const canvas = document.getElementById("speakerEditorCanvas");
    const template = document.getElementById("text-snippet-card-template");
    const scrollState = canvas.scrollTop;
    canvas.innerHTML = "";
    
    const usedIds = new Set();
    
    requestAnimationFrame(() => {
        const fragment = document.createDocumentFragment();
        this.projectFileState.actions.forEach(action => {
            if (action.type !== 'talk') return;

            action.speakers?.forEach(speaker => usedIds.add(speaker.characterId));

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
                
                const allNames = action.speakers.map(s => s.name).join(' & ');
                speakerNameDiv.textContent = allNames;

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
        canvas.scrollTop = scrollState;
    });

    return usedIds;
  },

  /**
   * 渲染右侧的可拖拽角色列表，并高亮已使用的角色。
   * @param {Set<number>} usedCharacterIds - 包含所有已使用角色ID的Set集合。
   */
  renderCharacterList(usedCharacterIds) {
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
      const characterId = ids[0];
      characterItem.dataset.characterId = characterId;
      characterItem.dataset.characterName = name;
      
      if (usedCharacterIds.has(characterId)) {
        characterItem.classList.add('is-used');
      }

      const avatarWrapper = { querySelector: (sel) => item.querySelector(sel) };
      configManager.updateConfigAvatar(avatarWrapper, characterId, name);

      item.querySelector(".character-name").textContent = name;
      fragment.appendChild(item);
    });
    listContainer.appendChild(fragment);
  },

  /**
   * 初始化SortableJS，实现双向拖拽和排序功能。
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
      // --- 步骤 3: 添加 onStart 和 onEnd 事件钩子 ---
      onStart: () => {
        // 当拖拽开始时，在 window 上监听鼠标移动事件
        document.addEventListener('dragover', this.handleDragScrolling);
      },
      onEnd: () => {
        // 当拖拽结束时，清理所有监听和定时器
        document.removeEventListener('dragover', this.handleDragScrolling);
        clearInterval(this.scrollInterval);
        this.scrollInterval = null;
      },
      onAdd: (evt) => {
        // --- 核心修正：移除所有手动DOM操作 ---
        const cardItem = evt.item;
        
        const actionId = cardItem.dataset.id;
        if (actionId) {
          // 只更新数据，让渲染函数来处理UI
          this.removeAllSpeakersFromAction(actionId);
        }

        // SortableJS 会自动处理临时DOM，我们不再需要下面的代码
        // if (sourceList.children[originalIndex]) { ... }
        // --- 修正结束 ---
      }
    });

    new Sortable(canvas, {
      group: 'shared-speakers',
      sort: true,
      animation: 150,

      onStart: () => {
        document.addEventListener('dragover', this.handleDragScrolling);
      },
      onEnd: (evt) => {
        document.removeEventListener('dragover', this.handleDragScrolling);
        clearInterval(this.scrollInterval);
        this.scrollInterval = null;

        if (evt.from === evt.to && evt.oldIndex !== evt.newIndex) {
            const [movedItem] = this.projectFileState.actions.splice(evt.oldIndex, 1);
            this.projectFileState.actions.splice(evt.newIndex, 0, movedItem);
        }
      },
      onAdd: (evt) => {
        const characterItem = evt.item;
        characterItem.style.display = 'none';
        const dropTargetElement = document.elementFromPoint(evt.originalEvent.clientX, evt.originalEvent.clientY);
        const targetCard = dropTargetElement ? dropTargetElement.closest('.dialogue-item') : null;
        
        if (!targetCard) {
            characterItem.remove();
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

   /**
   * --- 步骤 2: 创建新的核心滚动处理方法 ---
   * 在拖拽过程中处理画布的自动滚动。
   * @param {DragEvent} e - dragover 事件对象。
   */
  handleDragScrolling: (e) => {
    const canvas = document.getElementById('speakerEditorCanvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY;
    
    // 定义热区大小，例如上下各 50px
    const hotZone = 50;

    if (mouseY < rect.top + hotZone) {
      // 鼠标在顶部热区，向上滚动
      speakerEditor.scrollSpeed = -10; // 滚动速度和方向
      if (!speakerEditor.scrollInterval) {
        speakerEditor.startScrolling();
      }
    } else if (mouseY > rect.bottom - hotZone) {
      // 鼠标在底部热区，向下滚动
      speakerEditor.scrollSpeed = 10;
      if (!speakerEditor.scrollInterval) {
        speakerEditor.startScrolling();
      }
    } else {
      // 鼠标在中间区域，停止滚动
      clearInterval(speakerEditor.scrollInterval);
      speakerEditor.scrollInterval = null;
    }
  },

  /**
   * 启动一个定时器来持续滚动画布。
   */
  startScrolling() {
    const canvas = document.getElementById('speakerEditorCanvas');
    if (!canvas) return;

    this.scrollInterval = setInterval(() => {
        canvas.scrollTop += this.scrollSpeed;
    }, 20); // 每 20 毫秒滚动一次
  },
  
  /**
   * 更新说话人指派。
   * - 如果有多个项目被选中，则对所有选中项执行“替换”操作。
   * - 如果只有一个项目（当前拖拽的目标），则执行“追加”操作。
   * @param {string} actionId - 当前拖拽操作的目标action ID。
   * @param {object} newSpeaker - 新的说话人对象 { characterId, name }。
   */
  updateSpeakerAssignment(actionId, newSpeaker) {
    const selectedIds = selectionManager.getSelectedIds();
    let changesMade = false;

    // --- 核心修正：区分批量和单次操作 ---
    if (selectedIds.length > 1) {
      // 场景1: 批量操作 (有多个选中项) -> 执行替换
      ui.showStatus(`正在为 ${selectedIds.length} 个项目指派说话人...`, "info");
      
      selectedIds.forEach(id => {
        const actionToUpdate = this.projectFileState.actions.find(a => a.id === id);
        if (actionToUpdate) {
            // 批量操作总是替换
            actionToUpdate.speakers = [newSpeaker];
            changesMade = true;
        }
      });

    } else {
      // 场景2: 单次操作 (没有或只有一个选中项) -> 执行追加
      const actionToUpdate = this.projectFileState.actions.find(a => a.id === actionId);
      if (actionToUpdate) {
        const speakerExists = actionToUpdate.speakers.some(s => s.characterId === newSpeaker.characterId);
        
        if (!speakerExists) {
          actionToUpdate.speakers.push(newSpeaker); // 追加逻辑
          changesMade = true;
        } else {
          ui.showStatus("该角色已经是说话人。", "info");
        }
      }
    }
    // --- 修正结束 ---

    if (changesMade) {
        const usedIds = this.renderCanvas();
        this.renderCharacterList(usedIds);
    } else {
        if (selectedIds.length <= 1) { // 仅在单选时提示已存在
            ui.showStatus("该角色已经是说话人。", "info");
        }
    }

    // 操作完成后清空选项，准备下一次操作
    selectionManager.clear();
    // 手动触发一次事件以移除UI高亮
    document.getElementById('speakerEditorCanvas').dispatchEvent(new CustomEvent('selectionchange', {
        detail: { selectedIds: [] }
    }));
  },

  /**
   * 从指定action中移除一个说话人。
   * @param {string} actionId - action的ID。
   * @param {number} characterIdToRemove - 要移除的角色的ID。
   */
  removeSpeakerFromAction(actionId, characterIdToRemove) {
      const action = this.projectFileState.actions.find(a => a.id === actionId);
      if (action) {
          action.speakers = action.speakers.filter(s => s.characterId !== characterIdToRemove);
          const usedIds = this.renderCanvas();
          this.renderCharacterList(usedIds);
      }
  },

  /**
   * 移除指定action的所有说话人。
   * @param {string} actionId - action的ID。
   */
  removeAllSpeakersFromAction(actionId) {
      const action = this.projectFileState.actions.find(a => a.id === actionId);
      if (action) {
          action.speakers = [];
          const usedIds = this.renderCanvas();
          this.renderCharacterList(usedIds);
      }
  },

  /**
   * 显示用于管理多人对话的浮动窗口。
   * @param {string} actionId - action的ID。
   * @param {HTMLElement} targetElement - 点击的元素，用于定位浮窗。
   */
  showMultiSpeakerPopover(actionId, targetElement) {
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
  },

  /**
   * 保存当前编辑器的状态到全局 state.projectFile。
   */
  save() {
    state.set('projectFile', JSON.parse(JSON.stringify(this.projectFileState)));
    this.originalStateOnOpen = JSON.stringify(this.projectFileState); 
    ui.showStatus("工作进度已保存！", "success");
    ui.closeModal("speakerEditorModal");
  },

  /**
   * 将当前编辑器的状态导出为 JSON 文件。
   */
  exportProject() {
      if (!this.projectFileState) return;
      const dataStr = JSON.stringify(this.projectFileState, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const filename = this.projectFileState.projectName || `bestdori_project_${Date.now()}.json`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  },

  /**
   * 触发文件选择框，导入并加载一个项目文件。
   */
  importProject() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = (event) => {
              try {
                  const importedProject = JSON.parse(event.target.result);
                  if (importedProject && importedProject.actions) {
                      this.projectFileState = importedProject;
                      this.originalStateOnOpen = JSON.stringify(importedProject);
                      state.set('projectFile', JSON.parse(JSON.stringify(importedProject)));

                      const usedIds = this.renderCanvas();
                      this.renderCharacterList(usedIds);
                      ui.showStatus("项目导入成功！", "success");
                  } else {
                      throw new Error("无效的项目文件格式。");
                  }
              } catch (err) {
                  ui.showStatus(`导入失败: ${err.message}`, "error");
              }
          };
          reader.readAsText(file);
      };
      
      input.click();
  },

  /**
   * 恢复默认状态，即基于当前主界面的文本重新初始化。
   */
  async reset() {
      if (!confirm("确定要恢复默认吗？当前编辑模式下的所有修改都将丢失。")) {
          return;
      }
      try {
          const rawText = document.getElementById("inputText").value;
          const response = await axios.post("/api/segment-text", { text: rawText });
          const segments = response.data.segments;
          const newProjectFile = this.createProjectFileFromSegments(segments);
          this.projectFileState = newProjectFile;
          this.originalStateOnOpen = JSON.stringify(newProjectFile);
          
          const usedIds = this.renderCanvas();
          this.renderCharacterList(usedIds);
          ui.showStatus("已恢复为默认状态。", "info");
      } catch(error) {
          ui.showStatus("恢复默认失败。", "error");
      }
  }
};