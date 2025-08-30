import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";

export const speakerEditor = {
  projectFileState: null, // 模态框内的临时状态
  
  init() {
    const openBtn = document.getElementById("openSpeakerEditorBtn");
    if (openBtn) {
      openBtn.addEventListener("click", () => this.open());
    }

    // --- 新增：为功能按钮绑定事件 ---
    document.getElementById("saveSpeakersBtn")?.addEventListener("click", () => this.save());
    document.getElementById("exportProjectBtn")?.addEventListener("click", () => this.exportProject());
    document.getElementById("importProjectBtn")?.addEventListener("click", () => this.importProject());
    document.getElementById("resetSpeakersBtn")?.addEventListener("click", () => this.reset());

    // “取消”按钮的关闭事件已由 uiUtils.js 全局处理，但我们需要添加确认逻辑
    const cancelBtn = document.querySelector('#speakerEditorModal .btn-modal-close');
    const closeBtn = document.querySelector('#speakerEditorModal .modal-close');
    
    const cancelHandler = (e) => {
        // 简单的检查是否有修改，可以做得更精确
        if (JSON.stringify(this.projectFileState) !== JSON.stringify(state.get('projectFile'))) {
             if (!confirm("您有未保存的更改，确定要关闭吗？")) {
                e.stopPropagation(); // 阻止 uiUtils 的关闭事件
             }
        }
    };
    cancelBtn?.addEventListener('click', cancelHandler, true); // 使用捕获阶段提前拦截
    closeBtn?.addEventListener('click', cancelHandler, true);
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

      // --- 核心修改：加载逻辑 ---
        if (state.get('projectFile')) {
            // 如果全局状态中已有项目文件，直接加载它
            this.projectFileState = JSON.parse(JSON.stringify(state.get('projectFile'))); // 深拷贝以隔离编辑状态
            ui.showStatus("已加载现有项目进度。", "info");
        } else {
            // 否则，基于当前文本创建新项目
            this.projectFileState = this.createProjectFileFromSegments(segments);
        }
      
        this.renderCanvas();
        this.renderCharacterList();
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

  /**
   * 保存当前编辑器的状态到全局 state.projectFile。
   */
  save() {
    state.set('projectFile', JSON.parse(JSON.stringify(this.projectFileState))); // 深拷贝保存
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
      
      const a = document.createElement("a");
      a.href = url;
      // 假设 projectFileState 有一个 name 属性，否则使用默认名
      const filename = this.projectFileState.projectName || `bestdori_project_${Date.now()}.json`;
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
                  // TODO: 这里可以添加更严格的格式校验
                  if (importedProject && importedProject.actions) {
                      this.projectFileState = importedProject;
                      this.renderCanvas(); // 使用导入的数据重新渲染
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
          this.projectFileState = this.createProjectFileFromSegments(segments);
          this.renderCanvas();
          ui.showStatus("已恢复为默认状态。", "info");
      } catch(error) {
          ui.showStatus("恢复默认失败。", "error");
      }
  },

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