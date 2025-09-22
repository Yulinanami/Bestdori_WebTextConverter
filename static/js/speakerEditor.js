import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";
import { selectionManager } from "./selectionManager.js";
import { historyManager } from "./historyManager.js";
import { projectManager } from "./projectManager.js";
import { pinnedCharacterManager } from "./pinnedCharacterManager.js";

export const speakerEditor = {
  projectFileState: null,
  originalStateOnOpen: null,
  scrollInterval: null,
  scrollSpeed: 0,

  init() {
    document
      .getElementById("openSpeakerEditorBtn")
      ?.addEventListener("click", () => this.open());
    document
      .getElementById("saveSpeakersBtn")
      ?.addEventListener("click", () => this.save());
    document
      .getElementById("exportProjectBtn")
      ?.addEventListener("click", () => this.exportProject());
    document
      .getElementById("importProjectBtn")
      ?.addEventListener("click", () => this.importProject());
    document
      .getElementById("resetSpeakersBtn")
      ?.addEventListener("click", () => this.reset());
    document
      .getElementById("undoBtn")
      ?.addEventListener("click", () => historyManager.undo());
    document
      .getElementById("redoBtn")
      ?.addEventListener("click", () => historyManager.redo());
    const characterList = document.getElementById("speakerEditorCharacterList");
    if (characterList) {
      characterList.addEventListener("click", (e) => {
        const pinBtn = e.target.closest(".pin-btn");
        if (pinBtn) {
          e.stopPropagation();
          e.preventDefault();
          const characterItem = pinBtn.closest(".character-item");
          if (characterItem && characterItem.dataset.characterName) {
            const characterName = characterItem.dataset.characterName;
            pinnedCharacterManager.toggle(characterName);
            const usedIds = this._getUsedCharacterIds();
            this.renderCharacterList(usedIds);
          }
        }
      });
    }
    const modal = document.getElementById("speakerEditorModal");
    if (modal) {
      modal.focus();
    }
    const handleCloseAttempt = (e) => {
      if (JSON.stringify(this.projectFileState) !== this.originalStateOnOpen) {
        if (!confirm("您有未保存的更改，确定要关闭吗？")) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }
      }
      const canvas = document.getElementById("speakerEditorCanvas");
      selectionManager.detach(canvas);
      ui.closeModal("speakerEditorModal");
    };
    modal
      ?.querySelector(".btn-modal-close")
      ?.addEventListener("click", handleCloseAttempt, true);
    modal
      ?.querySelector(".modal-close")
      ?.addEventListener("click", handleCloseAttempt, true);
    document.addEventListener("historychange", (e) => {
      const undoBtn = document.getElementById("undoBtn");
      const redoBtn = document.getElementById("redoBtn");
      if (undoBtn) undoBtn.disabled = !e.detail.canUndo;
      if (redoBtn) redoBtn.disabled = !e.detail.canRedo;
    });
    modal?.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          historyManager.undo();
        } else if (
          e.key === "y" ||
          (e.shiftKey && (e.key === "z" || e.key === "Z"))
        ) {
          e.preventDefault();
          historyManager.redo();
        }
      }
    });
  },

  _getUsedCharacterIds() {
    const usedIds = new Set();
    if (this.projectFileState && this.projectFileState.actions) {
      this.projectFileState.actions.forEach((action) => {
        if (action.type === "talk" && action.speakers) {
          action.speakers.forEach((speaker) =>
            usedIds.add(speaker.characterId)
          );
        }
      });
    }
    return usedIds;
  },

  _closeEditor() {
    const canvas = document.getElementById("speakerEditorCanvas");
    selectionManager.detach(canvas);
    ui.closeModal("speakerEditorModal");
  },

  initiateClose() {
    if (JSON.stringify(this.projectFileState) !== this.originalStateOnOpen) {
      if (confirm("您有未保存的更改，确定要关闭吗？")) {
        this._closeEditor();
      }
    } else {
      this._closeEditor();
    }
  },

  async open() {
    ui.openModal("speakerEditorModal");

    try {
      let initialState;
      const rawText = document.getElementById("inputText").value;
      if (state.get("projectFile")) {
        initialState = state.get("projectFile");
        ui.showStatus("已加载现有项目进度。", "info");
      } else {
        const response = await axios.post("/api/segment-text", {
          text: rawText,
        });
        const segments = response.data.segments;
        initialState = this.createProjectFileFromSegments(segments);
      }
      this.projectFileState = JSON.parse(JSON.stringify(initialState));
      this.originalStateOnOpen = JSON.stringify(initialState);
      historyManager.clear();
      const usedCharacterIds = this.renderCanvas();
      this.renderCharacterList(usedCharacterIds);
      this.initDragAndDrop();
      const canvas = document.getElementById("speakerEditorCanvas");
      selectionManager.clear();
      selectionManager.attach(canvas, ".dialogue-item");
      canvas.addEventListener("selectionchange", (e) => {
        const selectedIds = new Set(e.detail.selectedIds);
        const allCards = canvas.querySelectorAll(".dialogue-item");
        allCards.forEach((card) => {
          if (selectedIds.has(card.dataset.id)) {
            card.classList.add("is-selected");
          } else {
            card.classList.remove("is-selected");
          }
        });
      });
    } catch (error) {
      ui.showStatus(
        `加载编辑器失败: ${error.response?.data?.error || error.message}`,
        "error"
      );
      this._closeEditor();
    }
  },

  _executeCommand(executeFn, context = {}) {
    const oldState = JSON.stringify(this.projectFileState);

    const command = {
      execute: () => {
        this.projectFileState = JSON.parse(
          JSON.stringify(this.projectFileState)
        );
        executeFn(this.projectFileState, context);
        const usedIds = this.renderCanvas();
        this.renderCharacterList(usedIds);
      },
      undo: () => {
        this.projectFileState = JSON.parse(oldState);
        const usedIds = this.renderCanvas();
        this.renderCharacterList(usedIds);
      },
    };
    historyManager.do(command);
  },

  createProjectFileFromSegments(segments) {
    const characterMap = new Map(
      Object.entries(state.get("currentConfig")).map(([name, ids]) => [
        name,
        { characterId: ids[0], name: name },
      ])
    );
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
          characterStates: {},
        };
      }),
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
      this.projectFileState.actions.forEach((action) => {
        if (action.type !== "talk") return;
        action.speakers?.forEach((speaker) => usedIds.add(speaker.characterId));
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
          dialogueItem.classList.remove("narrator");
          configManager.updateConfigAvatar(
            { querySelector: () => avatarDiv },
            firstSpeaker.characterId,
            firstSpeaker.name
          );
          const allNames = action.speakers.map((s) => s.name).join(" & ");
          speakerNameDiv.textContent = allNames;
          if (action.speakers.length > 1) {
            multiSpeakerBadge.style.display = "flex";
            multiSpeakerBadge.textContent = `+${action.speakers.length - 1}`;
            avatarContainer.style.cursor = "pointer";
            avatarContainer.addEventListener("click", (e) => {
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
          dialogueItem.classList.add("narrator");
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
    const characters = Object.entries(state.get("currentConfig"));
    const pinned = pinnedCharacterManager.getPinned();
    characters.sort(([nameA, idsA], [nameB, idsB]) => {
      const isAPinned = pinned.has(nameA);
      const isBPinned = pinned.has(nameB);
      if (isAPinned && !isBPinned) return -1;
      if (!isAPinned && isBPinned) return 1;
      return idsA[0] - idsB[0];
    });
    characters.forEach(([name, ids]) => {
      const item = template.content.cloneNode(true);
      const characterItem = item.querySelector(".character-item");
      const characterId = ids[0];
      characterItem.dataset.characterId = characterId;
      characterItem.dataset.characterName = name;
      if (usedCharacterIds && usedCharacterIds.has(characterId)) {
        characterItem.classList.add("is-used");
      }
      const avatarWrapper = { querySelector: (sel) => item.querySelector(sel) };
      configManager.updateConfigAvatar(avatarWrapper, characterId, name);
      item.querySelector(".character-name").textContent = name;
      const pinBtn = item.querySelector(".pin-btn");
      if (pinnedCharacterManager.isPinned(name)) {
        pinBtn.classList.add("is-pinned");
      }
      fragment.appendChild(item);
    });
    listContainer.appendChild(fragment);
  },

  initDragAndDrop() {
    const characterList = document.getElementById("speakerEditorCharacterList");
    const canvas = document.getElementById("speakerEditorCanvas");
    new Sortable(characterList, {
      group: {
        name: "shared-speakers",
        pull: "clone",
        put: true,
      },
      sort: false,
      onMove: function (evt) {
        return !evt.related.closest("#speakerEditorCharacterList");
      },
      onStart: () => {
        document.addEventListener("dragover", this.handleDragScrolling);
      },
      onEnd: () => {
        document.removeEventListener("dragover", this.handleDragScrolling);
        clearInterval(this.scrollInterval);
        this.scrollInterval = null;
      },
      onAdd: (evt) => {
        const cardItem = evt.item;
        const actionId = cardItem.dataset.id;
        if (actionId) {
          this.removeAllSpeakersFromAction(actionId);
        }
        cardItem.remove();
      },
    });
    new Sortable(canvas, {
      group: "shared-speakers",
      sort: true,
      animation: 150,
      onStart: () => {
        document.addEventListener("dragover", this.handleDragScrolling);
      },
      onEnd: (evt) => {
        document.removeEventListener("dragover", this.handleDragScrolling);
        clearInterval(this.scrollInterval);
        this.scrollInterval = null;
        if (evt.from === evt.to && evt.oldIndex !== evt.newIndex) {
          const { oldIndex, newIndex } = evt;
          this._executeCommand(
            (currentState, ctx) => {
              const [movedItem] = currentState.actions.splice(ctx.oldIndex, 1);
              currentState.actions.splice(ctx.newIndex, 0, movedItem);
            },
            { oldIndex, newIndex }
          );
        }
      },
      onAdd: (evt) => {
        const characterItem = evt.item;
        characterItem.style.display = "none";
        const dropTargetElement = document.elementFromPoint(
          evt.originalEvent.clientX,
          evt.originalEvent.clientY
        );
        const targetCard = dropTargetElement
          ? dropTargetElement.closest(".dialogue-item")
          : null;
        if (!targetCard) {
          characterItem.remove();
          return;
        }
        const characterId = parseInt(characterItem.dataset.characterId);
        const characterName = characterItem.dataset.characterName;
        const actionId = targetCard.dataset.id;
        if (characterId && actionId) {
          this.updateSpeakerAssignment(actionId, {
            characterId,
            name: characterName,
          });
        }
        characterItem.remove();
      },
    });
  },

  handleDragScrolling: (e) => {
    const canvas = document.getElementById("speakerEditorCanvas");
    const characterList = document.getElementById("speakerEditorCharacterList");
    if (!canvas || !characterList) return;
    let scrollTarget = null;
    if (e.target.closest("#speakerEditorCanvas")) {
      scrollTarget = canvas;
    } else if (e.target.closest("#speakerEditorCharacterList")) {
      scrollTarget = characterList;
    } else {
      clearInterval(speakerEditor.scrollInterval);
      speakerEditor.scrollInterval = null;
      return;
    }
    const rect = scrollTarget.getBoundingClientRect();
    const mouseY = e.clientY;
    const hotZone = 75;
    let newScrollSpeed = 0;
    if (mouseY < rect.top + hotZone) {
      newScrollSpeed = -10;
    } else if (mouseY > rect.bottom - hotZone) {
      newScrollSpeed = 10;
    }
    if (newScrollSpeed !== 0) {
      if (
        newScrollSpeed !== speakerEditor.scrollSpeed ||
        !speakerEditor.scrollInterval
      ) {
        speakerEditor.scrollSpeed = newScrollSpeed;
        speakerEditor.startScrolling(scrollTarget);
      }
    } else {
      clearInterval(speakerEditor.scrollInterval);
      speakerEditor.scrollInterval = null;
    }
  },

  startScrolling(elementToScroll) {
    clearInterval(this.scrollInterval);
    this.scrollInterval = setInterval(() => {
      if (elementToScroll) {
        elementToScroll.scrollTop += this.scrollSpeed;
      }
    }, 20);
  },

  updateSpeakerAssignment(actionId, newSpeaker) {
    const selectedIds = selectionManager.getSelectedIds();
    const context = {
      targetIds: selectedIds.length > 0 ? selectedIds : [actionId],
      newSpeaker: newSpeaker,
    };
    this._executeCommand((currentState, ctx) => {
      ctx.targetIds.forEach((id) => {
        const actionToUpdate = currentState.actions.find((a) => a.id === id);
        if (actionToUpdate) {
          const speakerExists = actionToUpdate.speakers.some(
            (s) => s.characterId === ctx.newSpeaker.characterId
          );
          if (!speakerExists) {
            actionToUpdate.speakers.push(ctx.newSpeaker);
          }
        }
      });
    }, context);
    selectionManager.clear();
    document
      .getElementById("speakerEditorCanvas")
      .dispatchEvent(
        new CustomEvent("selectionchange", { detail: { selectedIds: [] } })
      );
  },

  removeSpeakerFromAction(actionId, characterIdToRemove) {
    this._executeCommand(
      (currentState, ctx) => {
        const action = currentState.actions.find((a) => a.id === ctx.actionId);
        if (action) {
          action.speakers = action.speakers.filter(
            (s) => s.characterId !== ctx.characterIdToRemove
          );
        }
      },
      { actionId, characterIdToRemove }
    );
  },

  removeAllSpeakersFromAction(actionId) {
    this._executeCommand(
      (currentState, ctx) => {
        const action = currentState.actions.find((a) => a.id === ctx.actionId);
        if (action) {
          action.speakers = [];
        }
      },
      { actionId }
    );
  },

  showMultiSpeakerPopover(actionId, targetElement) {
    const existingPopover = document.getElementById("speaker-popover");
    if (existingPopover) existingPopover.remove();
    const action = this.projectFileState.actions.find((a) => a.id === actionId);
    if (!action) return;
    const popover = document.createElement("div");
    popover.id = "speaker-popover";
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
    action.speakers.forEach((speaker) => {
      const item = document.createElement("div");
      item.style.cssText = `display: flex; align-items: center; padding: 6px 8px; border-radius: 5px;`;
      const nameSpan = document.createElement("span");
      nameSpan.textContent = speaker.name;
      nameSpan.style.flexGrow = "1";
      const deleteBtn = document.createElement("button");
      deleteBtn.innerHTML = "&times;";
      deleteBtn.style.cssText = `
            border: none; background: #f1f5f9; color: #64748b; border-radius: 50%;
            width: 22px; height: 22px; cursor: pointer; margin-left: 10px;
            display: flex; align-items: center; justify-content: center; font-size: 16px; line-height: 1;
            transition: all 0.2s ease;
        `;
      deleteBtn.onmouseover = () => {
        deleteBtn.style.background = "#fee2e2";
        deleteBtn.style.color = "#ef4444";
      };
      deleteBtn.onmouseout = () => {
        deleteBtn.style.background = "#f1f5f9";
        deleteBtn.style.color = "#64748b";
      };
      deleteBtn.addEventListener("click", (e) => {
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
      document.addEventListener(
        "click",
        function onClickOutside(e) {
          if (!popover.contains(e.target)) {
            popover.remove();
            document.removeEventListener("click", onClickOutside);
          }
        },
        { once: true }
      );
    }, 0);
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
      state.set("projectFile", JSON.parse(JSON.stringify(importedProject)));
      historyManager.clear();
      const usedIds = this.renderCanvas();
      this.renderCharacterList(usedIds);
    }
  },

  async reset() {
    const getDefaultStateFn = async () => {
      const rawText = document.getElementById("inputText").value;
      const response = await axios.post("/api/segment-text", { text: rawText });
      return this.createProjectFileFromSegments(response.data.segments);
    };
    projectManager.reset(getDefaultStateFn, (newState) => {
      this.projectFileState = newState;
      this.originalStateOnOpen = JSON.stringify(newState);
      historyManager.clear();
      const usedIds = this.renderCanvas();
      this.renderCharacterList(usedIds);
      const canvas = document.getElementById("speakerEditorCanvas");
      selectionManager.detach(canvas);
      selectionManager.attach(canvas, ".dialogue-item");
    });
  },
};
