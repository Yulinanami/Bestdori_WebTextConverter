// live2d布局模式
import { state } from "./stateManager.js";
import { ui } from "./uiUtils.js";
import { configManager } from "./configManager.js";
import { positionManager } from "./positionManager.js";
import { costumeManager } from "./costumeManager.js";
import { historyManager } from "./historyManager.js";
import { projectManager } from "./projectManager.js";
import { pinnedCharacterManager } from "./pinnedCharacterManager.js";

export const live2dEditor = {
  projectFileState: null,
  originalStateOnOpen: null,
  scrollInterval: null,
  scrollSpeed: 0,

  init() {
    document
      .getElementById("openLive2dEditorBtn")
      ?.addEventListener("click", () => this.open());
    document
      .getElementById("autoLayoutBtn")
      ?.addEventListener("click", () => this._applyAutoLayout());
    document
      .getElementById("resetLayoutsBtn")
      ?.addEventListener("click", () => this._clearAllLayouts());
    document
      .getElementById("live2dUndoBtn")
      ?.addEventListener("click", () => historyManager.undo());
    document
      .getElementById("live2dRedoBtn")
      ?.addEventListener("click", () => historyManager.redo());
    document
      .getElementById("saveLayoutsBtn")
      ?.addEventListener("click", () => this.save());
    document
      .getElementById("importLayoutsBtn")
      ?.addEventListener("click", () => this.importProject());
    document
      .getElementById("exportLayoutsBtn")
      ?.addEventListener("click", () => this.exportProject());
    const characterList = document.getElementById("live2dEditorCharacterList");
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
            this.renderCharacterList();
          }
        }
      });
    }
    const modal = document.getElementById("live2dEditorModal");
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
    modal
      ?.querySelector(".btn-modal-close")
      ?.addEventListener("click", handleCloseAttempt, true);
    modal
      ?.querySelector(".modal-close")
      ?.addEventListener("click", handleCloseAttempt, true);
    document.addEventListener("historychange", (e) => {
      if (
        document.getElementById("live2dEditorModal").style.display === "flex"
      ) {
        document.getElementById("live2dUndoBtn").disabled = !e.detail.canUndo;
        document.getElementById("live2dRedoBtn").disabled = !e.detail.canRedo;
      }
    });
    modal?.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
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

  async open() {
    ui.openModal("live2dEditorModal");
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
        if (rawText.trim()) {
          ui.showStatus("已根据当前文本创建新项目。", "info");
        }
      }
      this.projectFileState = JSON.parse(JSON.stringify(initialState));
      this.originalStateOnOpen = JSON.stringify(initialState);
      historyManager.clear();
      this.renderTimeline();
      this.renderCharacterList();
      this.initDragAndDrop();
      const modal = document.getElementById("live2dEditorModal");
      if (modal) modal.focus();
      const timeline = document.getElementById("live2dEditorTimeline");
      timeline.onclick = (e) => {
        const card = e.target.closest(".layout-item");
        if (!card) return;
        if (e.target.matches(".layout-remove-btn")) {
          this._deleteLayoutAction(card.dataset.id);
        }
      };
      timeline.onchange = (e) => {
        const card = e.target.closest(".layout-item");
        if (!card || !e.target.matches("select, input")) return;
        this._updateLayoutActionProperty(card.dataset.id, e.target);
      };
    } catch (error) {
      ui.showStatus(
        `加载编辑器失败: ${error.response?.data?.error || error.message}`,
        "error"
      );
      this._closeEditor();
    }
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
      this.renderTimeline();
    }
  },

  _closeEditor() {
    ui.closeModal("live2dEditorModal");
  },

  _applyAutoLayout() {
    if (
      !confirm(
        "这将清空所有现有的Live2D布局，并根据角色的首次发言自动生成新的登场布局。确定要继续吗？"
      )
    ) {
      return;
    }
    this._executeCommand((currentState) => {
      currentState.actions = currentState.actions.filter(
        (a) => a.type !== "layout"
      );
      const appearedCharacterNames = new Set();
      const newActions = [];
      currentState.actions.forEach((action) => {
        if (action.type === "talk" && action.speakers.length > 0) {
          action.speakers.forEach((speaker) => {
            if (!appearedCharacterNames.has(speaker.name)) {
              appearedCharacterNames.add(speaker.name);
              const defaultCostume = this._getDefaultCostume(speaker.name);
              const positionConfig = positionManager.getCharacterPositionConfig(
                speaker.name,
                appearedCharacterNames.size - 1
              );
              const newLayoutAction = {
                id: `layout-action-${Date.now()}-${speaker.characterId}`,
                type: "layout",
                characterId: speaker.characterId,
                characterName: speaker.name,
                layoutType: "appear",
                costume: defaultCostume,
                position: {
                  from: {
                    side: positionConfig.position,
                    offsetX: positionConfig.offset,
                  },
                  to: {
                    side: positionConfig.position,
                    offsetX: positionConfig.offset,
                  },
                },
                initialState: {},
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
    projectManager.reset(
      () => {
        const newState = JSON.parse(JSON.stringify(this.projectFileState));
        newState.actions = newState.actions.filter((a) => a.type !== "layout");
        return newState;
      },
      (newState) => {
        this.projectFileState = newState;
        this.originalStateOnOpen = JSON.stringify(newState);
        historyManager.clear();
        this.renderTimeline();
      }
    );
  },

  _handleTimelineEvent(e) {
    const target = e.target;
    const card = target.closest(".layout-item");
    if (!card || !card.dataset.id) return;

    if (target.matches("select, input")) {
      const actionId = card.dataset.id;
      const value =
        target.type === "number" ? parseInt(target.value) || 0 : target.value;
      this._updateLayoutActionProperty(actionId, target, value);
    }
  },

  _updateLayoutActionProperty(actionId, targetElement) {
    const value =
      targetElement.type === "number"
        ? parseInt(targetElement.value) || 0
        : targetElement.value;
    const controlClassName = targetElement.className;
    this._executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (!action) return;
      if (controlClassName.includes("layout-type-select"))
        action.layoutType = value;
      else if (controlClassName.includes("layout-costume-select"))
        action.costume = value;
      else if (controlClassName.includes("layout-position-select-to"))
        action.position.to.side = value;
      else if (controlClassName.includes("layout-offset-input-to"))
        action.position.to.offsetX = value;
      else if (controlClassName.includes("layout-position-select")) {
        action.position.from.side = value;
        if (action.layoutType !== "move") action.position.to.side = value;
      } else if (controlClassName.includes("layout-offset-input")) {
        action.position.from.offsetX = value;
        if (action.layoutType !== "move") action.position.to.offsetX = value;
      }
    });
  },

  _updateLayoutAction(actionId, controlClassName, value) {
    const oldState = JSON.stringify(this.projectFileState);
    const command = {
      execute: () => {
        const action = this.projectFileState.actions.find(
          (a) => a.id === actionId
        );
        if (!action) return;
        if (controlClassName.includes("layout-type-select")) {
          action.layoutType = value;
        } else if (controlClassName.includes("layout-costume-select")) {
          action.costume = value;
        } else if (controlClassName.includes("layout-position-select")) {
          action.position.from.side = value;
          action.position.to.side = value;
        } else if (controlClassName.includes("layout-offset-input")) {
          action.position.from.offsetX = value;
          action.position.to.offsetX = value;
        }
        this.renderTimeline();
      },
      undo: () => {
        this.projectFileState = JSON.parse(oldState);
        this.renderTimeline();
      },
    };
    historyManager.do(command);
  },

  _deleteLayoutAction(actionId) {
    this._executeCommand((currentState) => {
      currentState.actions = currentState.actions.filter(
        (a) => a.id !== actionId
      );
    });
  },

  handleDragScrolling: (e) => {
    const timeline = document.getElementById("live2dEditorTimeline");
    const characterList = document.getElementById("live2dEditorCharacterList");
    if (!timeline || !characterList) return;
    let scrollTarget = null;
    if (e.target.closest("#live2dEditorTimeline")) {
      scrollTarget = timeline;
    } else if (e.target.closest("#live2dEditorCharacterList")) {
      scrollTarget = characterList;
    } else {
      clearInterval(live2dEditor.scrollInterval);
      live2dEditor.scrollInterval = null;
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
        newScrollSpeed !== live2dEditor.scrollSpeed ||
        !live2dEditor.scrollInterval
      ) {
        live2dEditor.scrollSpeed = newScrollSpeed;
        live2dEditor.startScrolling(scrollTarget);
      }
    } else {
      clearInterval(live2dEditor.scrollInterval);
      live2dEditor.scrollInterval = null;
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

  initDragAndDrop() {
    const characterList = document.getElementById("live2dEditorCharacterList");
    const timeline = document.getElementById("live2dEditorTimeline");
    new Sortable(characterList, {
      group: {
        name: "live2d-shared",
        pull: "clone",
        put: true,
      },
      sort: false,
      onMove: function (evt) {
        return !evt.related.closest("#live2dEditorCharacterList");
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
        const item = evt.item;
        if (item.classList.contains("layout-item") && item.dataset.id) {
          this._deleteLayoutAction(item.dataset.id);
        }
        item.remove();
      },
    });
    new Sortable(timeline, {
      group: "live2d-shared",
      animation: 150,
      sort: true,
      onStart: () => {
        document.addEventListener("dragover", this.handleDragScrolling);
      },
      onEnd: (evt) => {
        document.removeEventListener("dragover", this.handleDragScrolling);
        clearInterval(this.scrollInterval);
        this.scrollInterval = null;
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
        if (characterItem.classList.contains("character-item")) {
          const characterId = parseInt(characterItem.dataset.characterId);
          const characterName = characterItem.dataset.characterName;
          this.insertLayoutAction(characterId, characterName, insertAtIndex);
          characterItem.remove();
        }
      },
    });
  },

  insertLayoutAction(characterId, characterName, index) {
    this._executeCommand((currentState) => {
      const previousState = this._getCharacterStateAtIndex(
        currentState.actions,
        characterName,
        index
      );
      const layoutType = previousState.onStage ? "move" : "appear";
      const costumeToUse =
        previousState.lastCostume || this._getDefaultCostume(characterName);
      const defaultPosition = this._getDefaultPosition(characterName);
      const fromPosition = previousState.lastPosition
        ? { ...previousState.lastPosition }
        : { side: defaultPosition.position, offsetX: defaultPosition.offset };

      const newLayoutAction = {
        id: `layout-action-${Date.now()}`,
        type: "layout",
        characterId,
        characterName,
        layoutType: layoutType,
        costume: costumeToUse,
        position: {
          from: fromPosition,
          to: { ...fromPosition },
        },
        initialState: {},
      };
      currentState.actions.splice(index, 0, newLayoutAction);
    });
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
        this.renderTimeline();
      },
      undo: () => {
        this.projectFileState = JSON.parse(beforeState);
        this.renderTimeline();
      },
    };
    historyManager.do(command);
  },

  _getDefaultCostume(characterName) {
    return state.get("currentCostumes")[characterName] || "";
  },

  _getDefaultPosition(characterName) {
    if (
      !positionManager.autoPositionMode &&
      positionManager.manualPositions[characterName]
    ) {
      return {
        position:
          positionManager.manualPositions[characterName].position || "center",
        offset: positionManager.manualPositions[characterName].offset || 0,
      };
    }
    return { position: "center", offset: 0 };
  },

  renderTimeline() {
    const timeline = document.getElementById("live2dEditorTimeline");
    const talkTemplate = document.getElementById("timeline-talk-card-template");
    const layoutTemplate = document.getElementById(
      "timeline-layout-card-template"
    );
    timeline.innerHTML = "";
    const fragment = document.createDocumentFragment();
    this.projectFileState.actions.forEach((action) => {
      if (action.type === "talk") {
        const card = talkTemplate.content.cloneNode(true);
        card.querySelector(".timeline-item").dataset.id = action.id;
        const nameDiv = card.querySelector(".speaker-name");
        const avatarDiv = card.querySelector(".dialogue-avatar");
        if (action.speakers && action.speakers.length > 0) {
          const firstSpeaker = action.speakers[0];
          nameDiv.textContent = action.speakers.map((s) => s.name).join(" & ");
          configManager.updateConfigAvatar(
            { querySelector: () => avatarDiv },
            firstSpeaker.characterId,
            firstSpeaker.name
          );
        } else {
          nameDiv.textContent = "旁白";
          avatarDiv.classList.add("fallback");
          avatarDiv.textContent = "N";
        }
        card.querySelector(".dialogue-preview-text").textContent = action.text;
        fragment.appendChild(card);
      } else if (action.type === "layout") {
        const card = layoutTemplate.content.cloneNode(true);
        const item = card.querySelector(".timeline-item");
        item.dataset.id = action.id;
        item.dataset.layoutType = action.layoutType;
        const characterId = action.characterId;
        const characterName =
          action.characterName ||
          configManager.getCharacterNameById(characterId);
        card.querySelector(".speaker-name").textContent =
          characterName || `未知角色 (ID: ${characterId})`;
        const avatarDiv = card.querySelector(".dialogue-avatar");
        configManager.updateConfigAvatar(
          { querySelector: () => avatarDiv },
          characterId,
          characterName
        );
        const typeSelect = card.querySelector(".layout-type-select");
        typeSelect.value = action.layoutType;
        const positionSelect = card.querySelector(".layout-position-select");
        const offsetInput = card.querySelector(".layout-offset-input");
        const toPositionSelect = card.querySelector(
          ".layout-position-select-to"
        );
        const currentPosition = action.position?.from?.side || "center";
        const currentOffset = action.position?.from?.offsetX || 0;
        const costumeSelect = card.querySelector(".layout-costume-select");
        costumeSelect.innerHTML = "";
        const availableCostumes =
          costumeManager.availableCostumes[characterName] || [];
        availableCostumes.forEach((costumeId) => {
          const option = new Option(costumeId, costumeId);
          costumeSelect.add(option);
        });
        if (action.costume && !availableCostumes.includes(action.costume)) {
          const option = new Option(
            `${action.costume} (自定义)`,
            action.costume
          );
          costumeSelect.add(option, 0);
        }
        costumeSelect.value = action.costume;
        positionSelect.innerHTML = "";
        toPositionSelect.innerHTML = "";
        Object.entries(positionManager.positionNames).forEach(
          ([value, name]) => {
            const optionFrom = new Option(name, value);
            const optionTo = new Option(name, value);
            positionSelect.add(optionFrom);
            toPositionSelect.add(optionTo);
          }
        );
        positionSelect.value = currentPosition;
        offsetInput.value = currentOffset;
        const toPositionContainer = card.querySelector(
          ".to-position-container"
        );
        if (action.layoutType === "move") {
          toPositionContainer.style.display = "grid";
          card.querySelector(".layout-position-select-to").value =
            action.position?.to?.side || "center";
          card.querySelector(".layout-offset-input-to").value =
            action.position?.to?.offsetX || 0;
        } else {
          toPositionContainer.style.display = "none";
        }
        fragment.appendChild(card);
      }
    });
    timeline.appendChild(fragment);
  },

  renderCharacterList() {
    const listContainer = document.getElementById("live2dEditorCharacterList");
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
      characterItem.dataset.characterId = ids[0];
      characterItem.dataset.characterName = name;
      const avatarWrapper = { querySelector: (sel) => item.querySelector(sel) };
      configManager.updateConfigAvatar(avatarWrapper, ids[0], name);
      item.querySelector(".character-name").textContent = name;
      const pinBtn = item.querySelector(".pin-btn");
      if (pinnedCharacterManager.isPinned(name)) {
        pinBtn.classList.add("is-pinned");
      }
      fragment.appendChild(item);
    });
    listContainer.appendChild(fragment);
  },

  _getCharacterStateAtIndex(actions, characterName, startIndex) {
    let onStage = false;
    let lastPosition = null;
    let lastCostume = null;
    for (let i = 0; i < startIndex; i++) {
      const action = actions[i];
      if (action.type === "layout" && action.characterName === characterName) {
        if (action.layoutType === "appear" || action.layoutType === "move") {
          onStage = true;
          if (action.position && action.position.to) {
            lastPosition = {
              side: action.position.to.side,
              offsetX: action.position.to.offsetX,
            };
          }
          if (action.costume) {
            lastCostume = action.costume;
          }
        } else if (action.layoutType === "hide") {
          onStage = false;
          lastPosition = null;
        }
      }
    }
    return { onStage, lastPosition, lastCostume };
  },
};
