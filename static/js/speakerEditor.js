import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";
import { selectionManager } from "./selectionManager.js";
import { historyManager } from "./historyManager.js";

export const speakerEditor = {
  projectFileState: null,
  originalStateOnOpen: null,
  scrollInterval: null,
  scrollSpeed: 0,  
  
/**
   * 初始化模块，绑定所有必要的事件监听器。
   */
  init() {
    // 1. 绑定打开编辑器的按钮
    document.getElementById("openSpeakerEditorBtn")?.addEventListener("click", () => this.open());

    // 2. 绑定模态框内的功能按钮
    document.getElementById("saveSpeakersBtn")?.addEventListener("click", () => this.save());
    document.getElementById("exportProjectBtn")?.addEventListener("click", () => this.exportProject());
    document.getElementById("importProjectBtn")?.addEventListener("click", () => this.importProject());
    document.getElementById("resetSpeakersBtn")?.addEventListener("click", () => this.reset());
    document.getElementById("undoBtn")?.addEventListener("click", () => historyManager.undo());
    document.getElementById("redoBtn")?.addEventListener("click", () => historyManager.redo());

    // 3. 统一处理关闭事件（取消和X按钮）
    const modal = document.getElementById('speakerEditorModal');
    if (modal) {
        modal.focus();
    }
    const handleCloseAttempt = (e) => {
        if (JSON.stringify(this.projectFileState) !== this.originalStateOnOpen) {
             if (!confirm("您有未保存的更改，确定要关闭吗？")) {
                e.stopPropagation();
                e.preventDefault();
                return; // 阻止关闭
             }
        }
        // 清理并关闭
        const canvas = document.getElementById('speakerEditorCanvas');
        selectionManager.detach(canvas);
        ui.closeModal('speakerEditorModal');
    };
    modal?.querySelector('.btn-modal-close')?.addEventListener('click', handleCloseAttempt, true);
    modal?.querySelector('.modal-close')?.addEventListener('click', handleCloseAttempt, true);

    // 4. 监听历史变化以更新按钮状态
    document.addEventListener('historychange', (e) => {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        if (undoBtn) undoBtn.disabled = !e.detail.canUndo;
        if (redoBtn) redoBtn.disabled = !e.detail.canRedo;
    });

    // 5. 添加键盘快捷键
    modal?.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') { e.preventDefault(); historyManager.undo(); }
            else if (e.key === 'y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z'))) { e.preventDefault(); historyManager.redo(); }
        }
    });
  },

  /**
   * 统一的关闭编辑器前的清理和检查逻辑。
   */
  _closeEditor() {
    const canvas = document.getElementById('speakerEditorCanvas');
    selectionManager.detach(canvas);
    ui.closeModal("speakerEditorModal");
  },

  /**
   * 由关闭按钮触发，检查是否有未保存的更改。
   */
  initiateClose() {
    if (JSON.stringify(this.projectFileState) !== this.originalStateOnOpen) {
         if (confirm("您有未保存的更改，确定要关闭吗？")) {
            this._closeEditor();
         }
    } else {
        this._closeEditor();
    }
  },

  /**
   * 打开编辑器模态框。
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
      
      historyManager.clear();
      
      const usedCharacterIds = this.renderCanvas();
      this.renderCharacterList(usedCharacterIds);
      this.initDragAndDrop();
      
      const canvas = document.getElementById('speakerEditorCanvas');
      selectionManager.clear();
      selectionManager.attach(canvas, '.dialogue-item');

      canvas.addEventListener('selectionchange', (e) => {
          const selectedIds = new Set(e.detail.selectedIds);
          const allCards = canvas.querySelectorAll('.dialogue-item');
          allCards.forEach(card => {
              if (selectedIds.has(card.dataset.id)) { card.classList.add('is-selected'); }
              else { card.classList.remove('is-selected'); }
          });
      });      
    } catch (error) {
      ui.showStatus(`加载编辑器失败: ${error.response?.data?.error || error.message}`, "error");
      this._closeEditor(); // 出错时也要确保清理
    }
  },

  /**
   * --- 核心修正 1: 修改 _executeCommand ---
   * 创建一个命令对象，并捕获执行该命令所需的上下文。
   * @param {function} executeFn - 一个执行修改的函数，它接收 (currentState, context) 作为参数。
   * @param {object} context - 执行该命令所需的任何上下文数据。
   */
  _executeCommand(executeFn, context = {}) {
      const oldState = JSON.stringify(this.projectFileState);

      const command = {
          execute: () => {
              this.projectFileState = JSON.parse(JSON.stringify(this.projectFileState));
              // 将捕获的上下文传递给执行函数
              executeFn(this.projectFileState, context);
              const usedIds = this.renderCanvas();
              this.renderCharacterList(usedIds);
          },
          undo: () => {
              this.projectFileState = JSON.parse(oldState);
              const usedIds = this.renderCanvas();
              this.renderCharacterList(usedIds);
          }
      };
      
      historyManager.do(command);
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
            if (evt.from === evt.to && evt.oldIndex !== evt.newIndex) {
                const { oldIndex, newIndex } = evt;
                // 将上下文（索引）捕获
                this._executeCommand((currentState, ctx) => {
                    const [movedItem] = currentState.actions.splice(ctx.oldIndex, 1);
                    currentState.actions.splice(ctx.newIndex, 0, movedItem);
                }, { oldIndex, newIndex });
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
   * --- 核心修正：重构滚动处理逻辑 ---
   * 在拖拽过程中处理画布或角色列表的自动滚动。
   * @param {DragEvent} e - dragover 事件对象。
   */
  handleDragScrolling: (e) => {
    const canvas = document.getElementById('speakerEditorCanvas');
    const characterList = document.getElementById('speakerEditorCharacterList');
    if (!canvas || !characterList) return;
    
    // 1. 判断鼠标当前在哪一个滚动容器内
    let scrollTarget = null;
    if (e.target.closest('#speakerEditorCanvas')) {
        scrollTarget = canvas;
    } else if (e.target.closest('#speakerEditorCharacterList')) {
        scrollTarget = characterList;
    } else {
        // 如果鼠标不在任何一个可滚动区域，则停止滚动并返回
        clearInterval(speakerEditor.scrollInterval);
        speakerEditor.scrollInterval = null;
        return;
    }

    const rect = scrollTarget.getBoundingClientRect();
    const mouseY = e.clientY;
    
    // 定义热区大小
    const hotZone = 75;
    let newScrollSpeed = 0;

    if (mouseY < rect.top + hotZone) {
      newScrollSpeed = -10; // 向上滚动
    } else if (mouseY > rect.bottom - hotZone) {
      newScrollSpeed = 10; // 向下滚动
    }
    
    // 2. 只有在需要滚动或需要停止时才操作定时器
    if (newScrollSpeed !== 0) {
        // 如果滚动速度或目标改变，或者定时器未启动，则重新启动
        if (newScrollSpeed !== speakerEditor.scrollSpeed || !speakerEditor.scrollInterval) {
            speakerEditor.scrollSpeed = newScrollSpeed;
            speakerEditor.startScrolling(scrollTarget);
        }
    } else {
        clearInterval(speakerEditor.scrollInterval);
        speakerEditor.scrollInterval = null;
    }
  },

  /**
   * 启动一个定时器来持续滚动指定的元素。
   * @param {HTMLElement} elementToScroll - 需要被滚动的DOM元素。
   */
  startScrolling(elementToScroll) {
    // 先清除可能存在的旧定时器
    clearInterval(this.scrollInterval);
    
    this.scrollInterval = setInterval(() => {
        if (elementToScroll) {
            elementToScroll.scrollTop += this.scrollSpeed;
        }
    }, 20);
  },
  
/**
   * 更新说话人指派。此操作会被记录到历史中。
   */
  updateSpeakerAssignment(actionId, newSpeaker) {
    const selectedIds = selectionManager.getSelectedIds();
    // 捕获当前的上下文
    const context = {
        targetIds: selectedIds.length > 0 ? selectedIds : [actionId],
        newSpeaker: newSpeaker
    };

    this._executeCommand((currentState, ctx) => {
        ctx.targetIds.forEach(id => {
            const actionToUpdate = currentState.actions.find(a => a.id === id);
            if (actionToUpdate) {
                const speakerExists = actionToUpdate.speakers.some(s => s.characterId === ctx.newSpeaker.characterId);
                if (!speakerExists) {
                    actionToUpdate.speakers.push(ctx.newSpeaker);
                }
            }
        });
    }, context); // 将上下文传入
    
    // UI清理逻辑保持不变
    selectionManager.clear();
    document.getElementById('speakerEditorCanvas').dispatchEvent(new CustomEvent('selectionchange', { detail: { selectedIds: [] } }));
  },

/**
   * 从指定action中移除一个说话人。此操作会被记录到历史中。
   */
  removeSpeakerFromAction(actionId, characterIdToRemove) {
      this._executeCommand((currentState, ctx) => {
          const action = currentState.actions.find(a => a.id === ctx.actionId);
          if (action) {
              action.speakers = action.speakers.filter(s => s.characterId !== ctx.characterIdToRemove);
          }
      }, { actionId, characterIdToRemove }); // 捕获上下文
  },

/**
   * 移除指定action的所有说话人。此操作会被记录到历史中。
   */
  removeAllSpeakersFromAction(actionId) {
      this._executeCommand((currentState, ctx) => {
          const action = currentState.actions.find(a => a.id === ctx.actionId);
          if (action) {
              action.speakers = [];
          }
      }, { actionId }); // 捕获上下文
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
   * 保存并关闭编辑器。
   */
  save() {
    state.set('projectFile', JSON.parse(JSON.stringify(this.projectFileState)));
    this.originalStateOnOpen = JSON.stringify(this.projectFileState); 
    ui.showStatus("工作进度已保存！", "success");
    this._closeEditor();
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
   * 导入项目文件，并清空历史记录。
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

                      // --- 导入后清空历史 ---
                      historyManager.clear();

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
   * 恢复默认状态，并清空历史记录。
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
          
          // --- 重置后清空历史 ---
          historyManager.clear();
          
          const usedIds = this.renderCanvas();
          this.renderCharacterList(usedIds);
          ui.showStatus("已恢复为默认状态。", "info");
          
          const canvas = document.getElementById('speakerEditorCanvas');
          selectionManager.detach(canvas);
          selectionManager.attach(canvas, '.dialogue-item');          
      } catch(error) {
          ui.showStatus("恢复默认失败。", "error");
      }
  },
};