import { ui, renderGroupedView } from "./uiUtils.js";
import { historyManager } from "./historyManager.js";
import { editorService } from "./services/EditorService.js";
import { DataUtils } from "./utils/DataUtils.js";
import { DOMUtils } from "./utils/DOMUtils.js";
import { BaseEditor } from "./utils/BaseEditor.js";
import { DragHelper } from "./utils/DragHelper.js";
import { EditorHelper } from "./utils/EditorHelper.js";

// 创建基础编辑器实例
const baseEditor = new BaseEditor({
  renderCallback: () => {
    const usedIds = speakerEditor.renderCanvas();
    speakerEditor.renderCharacterList(usedIds);
    speakerEditor._reattachSelection(); // 重新绑定选择功能
  },
  afterCommandCallback: () => {
    // 撤销/重做后清除缓存
    speakerEditor._invalidateCache();
  },
  groupSize: 50,
});

export const speakerEditor = {
  // 使用 baseEditor 代理状态管理
  get projectFileState() {
    return baseEditor.projectFileState;
  },
  set projectFileState(value) {
    baseEditor.projectFileState = value;
    this._invalidateCache(); // 清除缓存
  },
  get originalStateOnOpen() {
    return baseEditor.originalStateOnOpen;
  },
  set originalStateOnOpen(value) {
    baseEditor.originalStateOnOpen = value;
  },
  get activeGroupIndex() {
    return baseEditor.activeGroupIndex;
  },
  set activeGroupIndex(value) {
    baseEditor.activeGroupIndex = value;
  },

  // DOM 缓存
  domCache: {},
  // 计算结果缓存
  _usedCharacterIdsCache: null,
  // Sortable 实例管理
  sortableInstances: [],
  // 滚动动画
  scrollAnimationFrame: null,
  scrollSpeed: 0,

  init() {
    // 缓存 DOM 元素
    this.domCache = {
      groupCheckbox: document.getElementById("groupCardsCheckbox"),
      canvas: document.getElementById("speakerEditorCanvas"),
      characterList: document.getElementById("speakerEditorCharacterList"),
      modal: document.getElementById("speakerEditorModal"),
      undoBtn: document.getElementById("undoBtn"),
      redoBtn: document.getElementById("redoBtn"),
    };

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
    this.domCache.undoBtn?.addEventListener("click", () => historyManager.undo());
    this.domCache.redoBtn?.addEventListener("click", () => historyManager.redo());
    const characterList = this.domCache.characterList;
    if (characterList) {
      characterList.addEventListener("click", (e) => {
        const pinBtn = e.target.closest(".pin-btn");
        if (pinBtn) {
          e.stopPropagation();
          e.preventDefault();
          const characterItem = pinBtn.closest(".character-item");
          if (characterItem && characterItem.dataset.characterName) {
            const characterName = characterItem.dataset.characterName;
            editorService.togglePinCharacter(characterName);
            const usedIds = this._getUsedCharacterIds();
            this.renderCharacterList(usedIds);
          }
        }
      });
    }
    if (this.domCache.modal) {
      this.domCache.modal.focus();
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
      editorService.detachSelection(canvas);
      ui.closeModal("speakerEditorModal");
    };
    this.domCache.modal
      ?.querySelector(".modal-close")
      ?.addEventListener("click", handleCloseAttempt, true);
    document.addEventListener("historychange", (e) => {
      if (this.domCache.undoBtn) this.domCache.undoBtn.disabled = !e.detail.canUndo;
      if (this.domCache.redoBtn) this.domCache.redoBtn.disabled = !e.detail.canRedo;
    });
    this.domCache.modal?.addEventListener("keydown", (e) => {
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

  _findClosestCard(y) {
    const canvas = this.domCache.canvas;
    if (!canvas) return null;
    const cards = Array.from(canvas.querySelectorAll(".dialogue-item"));

    let closestCard = null;
    let minDistance = Infinity;

    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const cardCenterY = rect.top + rect.height / 2;
      const distance = Math.abs(y - cardCenterY);

      if (distance < minDistance) {
        minDistance = distance;
        closestCard = card;
      }
    }
    // 添加一个阈值，如果拖拽位置离任何卡片都太远，则不视为有效目标
    const closestRect = closestCard
      ? closestCard.getBoundingClientRect()
      : null;
    if (closestCard && minDistance > closestRect.height) {
      return null;
    }
    return closestCard;
  },

  _invalidateCache() {
    this._usedCharacterIdsCache = null;
  },

  _reattachSelection() {
    const canvas = this.domCache.canvas;
    if (canvas) {
      editorService.detachSelection(canvas);
      editorService.clearSelection();
      editorService.attachSelection(canvas, ".dialogue-item");
    }
  },

  /**
   * 获取所有已使用的角色ID(带缓存优化)
   * 缓存在状态改变时由_invalidateCache()清除
   * @returns {Set<number>} 角色ID集合
   */
  _getUsedCharacterIds() {
    if (this._usedCharacterIdsCache) {
      return this._usedCharacterIdsCache;
    }

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
    this._usedCharacterIdsCache = usedIds;
    return usedIds;
  },

  _closeEditor() {
    EditorHelper.closeEditor({
      modalId: "speakerEditorModal",
      beforeClose: () => {
        // 销毁 Sortable 实例
        this.sortableInstances.forEach(instance => instance?.destroy());
        this.sortableInstances = [];

        // 停止滚动动画
        if (this.scrollAnimationFrame) {
          cancelAnimationFrame(this.scrollAnimationFrame);
          this.scrollAnimationFrame = null;
        }

        editorService.detachSelection(this.domCache.canvas);
      },
    });
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
    await EditorHelper.openEditor({
      editor: baseEditor,
      modalId: "speakerEditorModal",
      buttonId: "openSpeakerEditorBtn",
      loadingText: "加载中...",
      beforeOpen: async () => {
        try {
          let initialState;
          const rawText = document.getElementById("inputText").value;
          const projectState = editorService.getProjectState();
          if (projectState) {
            initialState = projectState;
            ui.showStatus("已加载现有项目进度。", "info");
          } else {
            const response = await axios.post("/api/segment-text", {
              text: rawText,
            });
            const segments = response.data.segments;
            initialState = this.createProjectFileFromSegments(segments);
          }
          this.projectFileState = DataUtils.deepClone(initialState);
          this.originalStateOnOpen = JSON.stringify(initialState);
          historyManager.clear();
        } catch (error) {
          ui.showStatus(
            `加载编辑器失败: ${error.response?.data?.error || error.message}`,
            "error"
          );
          throw error;
        }
      },
      afterOpen: async () => {
        const usedCharacterIds = this.renderCanvas();
        this.renderCharacterList(usedCharacterIds);
        this.initDragAndDrop();
        const canvas = document.getElementById("speakerEditorCanvas");
        editorService.clearSelection();
        editorService.attachSelection(canvas, ".dialogue-item");
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
      },
    });
  },

  // 使用 BaseEditor 的 executeCommand 方法
  _executeCommand(changeFn) {
    baseEditor.executeCommand(changeFn);
  },

  createProjectFileFromSegments(segments) {
    const characterMap = new Map(
      Object.entries(editorService.getCurrentConfig()).map(([name, ids]) => [
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
   * 渲染左侧对话卡片画布
   * 支持分组模式和普通模式两种渲染方式:
   * - 分组模式: 每50条对话折叠为一组,提升长剧本性能
   * - 普通模式: 一次性渲染所有对话卡片
   * 卡片显示对话文本、说话人头像、序号,支持多说话人徽章
   * @returns {Set<number>} 已使用的角色ID集合
   */
  renderCanvas() {
    const canvas = this.domCache.canvas;
    if (!canvas) return new Set();

    const usedIds = this._getUsedCharacterIds(); // 使用缓存
    const isGroupingEnabled = this.domCache.groupCheckbox?.checked || false;
    const actions = this.projectFileState.actions.filter(
      (a) => a.type === "talk"
    );
    const groupSize = 50;

    // 创建索引缓存 Map 以提升性能
    const actionIndexMap = new Map(
      this.projectFileState.actions.map((a, idx) => [a.id, idx])
    );

    const renderSingleCard = (action) => {
      const globalIndex = actionIndexMap.get(action.id) ?? -1;
      const template = document.getElementById("text-snippet-card-template");
      const card = template.content.cloneNode(true);
      const numberDiv = card.querySelector(".card-sequence-number");
      if (numberDiv && globalIndex !== -1) {
        numberDiv.textContent = `#${globalIndex + 1}`;
      }
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
        editorService.updateCharacterAvatar(
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
      return card;
    };

    if (isGroupingEnabled && actions.length > groupSize) {
      renderGroupedView({
        container: canvas,
        actions: actions,
        activeGroupIndex: this.activeGroupIndex,
        onGroupClick: (index) => {
          const isOpening = this.activeGroupIndex !== index;
          this.activeGroupIndex = isOpening ? index : null;
          this.renderCanvas();

          if (isOpening) {
            setTimeout(() => {
              const scrollContainer = this.domCache.canvas;
              const header = scrollContainer?.querySelector(
                `.timeline-group-header[data-group-idx="${index}"]`
              );
              if (scrollContainer && header) {
                scrollContainer.scrollTo({
                  top: header.offsetTop - 110,
                  behavior: "smooth",
                });
              }
            }, 0);
          }
        },
        renderItemFn: renderSingleCard,
        groupSize: groupSize,
      });
    } else {
      DOMUtils.clearElement(canvas);
      const fragment = document.createDocumentFragment();
      actions.forEach((action) => {
        fragment.appendChild(renderSingleCard(action));
      });
      canvas.appendChild(fragment);
    }

    return usedIds;
  },

  /**
   * 渲染右侧的可拖拽角色列表，并高亮已使用的角色。
   * @param {Set<number>} usedCharacterIds - 包含所有已使用角色ID的Set集合。
   */
  renderCharacterList(usedCharacterIds) {
    const listContainer = document.getElementById("speakerEditorCharacterList");
    const template = document.getElementById("draggable-character-template");
    DOMUtils.clearElement(listContainer);
    const fragment = document.createDocumentFragment();
    const characters = editorService.getAllCharacters();
    const pinned = editorService.getPinnedCharacters();
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
      editorService.updateCharacterAvatar(avatarWrapper, characterId, name);
      item.querySelector(".character-name").textContent = name;
      const pinBtn = item.querySelector(".pin-btn");
      if (pinned.has(name)) {
        pinBtn.classList.add("is-pinned");
      }
      fragment.appendChild(item);
    });
    listContainer.appendChild(fragment);
  },

  /**
   * 初始化拖拽功能
   * 设置两个Sortable实例:
   * 1. 角色列表 - 可拖出(clone模式),拖回时清除说话人
   * 2. 对话画布 - 可排序,可接收角色拖入并分配说话人
   */
  initDragAndDrop() {
    const characterList = this.domCache.characterList;
    const canvas = this.domCache.canvas;
    if (!characterList || !canvas) return;

    // 清理旧的 Sortable 实例
    this.sortableInstances.forEach(instance => instance?.destroy());
    this.sortableInstances = [];

    // 角色列表的Sortable配置
    this.sortableInstances.push(new Sortable(characterList, {
      group: {
        name: "shared-speakers",
        pull: "clone", // 拖出时克隆
        put: true, // 可接收拖回
      },
      sort: false,
      onMove: (evt) => {
        return !evt.related.closest("#speakerEditorCharacterList");
      },
      onStart: () => {
        document.addEventListener("dragover", this.handleDragScrolling);
      },
      onEnd: () => {
        document.removeEventListener("dragover", this.handleDragScrolling);
        this.stopScrolling();
      },
      onAdd: (evt) => {
        // 拖回角色列表时,清除该对话的说话人
        const cardItem = evt.item;
        const actionId = cardItem.dataset.id;
        if (actionId) {
          this.removeAllSpeakersFromAction(actionId);
        }
        cardItem.remove();
      },
    }));
    // 使用 DragHelper 创建 onEnd 处理器（移动现有卡片）
    const onEndHandler = DragHelper.createOnEndHandler({
      editor: baseEditor,
      getGroupingEnabled: () => this.domCache.groupCheckbox?.checked || false,
      groupSize: 50,
      executeFn: (globalOldIndex, globalNewIndex) => {
        this._executeCommand((currentState) => {
          const [movedItem] = currentState.actions.splice(globalOldIndex, 1);
          currentState.actions.splice(globalNewIndex, 0, movedItem);
        });
      },
    });

    // 创建自定义的 onAdd 处理器（speakerEditor 有特殊逻辑）
    const onAddHandler = (evt) => {
      const characterItem = evt.item;
      characterItem.style.display = "none";
      const dropY = evt.originalEvent.clientY;
      const targetCard = this._findClosestCard(dropY);

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
    };

    this.sortableInstances.push(new Sortable(
      canvas,
      DragHelper.createSortableConfig({
        group: "shared-speakers",
        onEnd: (evt) => {
          document.removeEventListener("dragover", this.handleDragScrolling);
          this.stopScrolling();
          onEndHandler(evt);
        },
        onAdd: onAddHandler,
        extraConfig: {
          sort: true,
          onStart: () => {
            document.addEventListener("dragover", this.handleDragScrolling);
          },
        },
      })
    ));
  },

  // 使用 BaseEditor 的 getGlobalIndex 方法
  _getGlobalIndex(localIndex) {
    const isGroupingEnabled = this.domCache.groupCheckbox?.checked || false;
    return baseEditor.getGlobalIndex(localIndex, isGroupingEnabled);
  },

  handleDragScrolling: (e) => {
    const canvas = speakerEditor.domCache.canvas;
    const characterList = speakerEditor.domCache.characterList;
    if (!canvas || !characterList) return;

    let scrollTarget = null;
    if (e.target.closest("#speakerEditorCanvas")) {
      scrollTarget = canvas;
    } else if (e.target.closest("#speakerEditorCharacterList")) {
      scrollTarget = characterList;
    } else {
      speakerEditor.stopScrolling();
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
      if (newScrollSpeed !== speakerEditor.scrollSpeed || !speakerEditor.scrollAnimationFrame) {
        speakerEditor.scrollSpeed = newScrollSpeed;
        speakerEditor.startScrolling(scrollTarget);
      }
    } else {
      speakerEditor.stopScrolling();
    }
  },

  // 使用 requestAnimationFrame 优化滚动性能
  startScrolling(elementToScroll) {
    this.stopScrolling(); // 先停止之前的动画

    const scroll = () => {
      if (elementToScroll && this.scrollSpeed !== 0) {
        elementToScroll.scrollTop += this.scrollSpeed;
        this.scrollAnimationFrame = requestAnimationFrame(scroll);
      }
    };
    scroll();
  },

  stopScrolling() {
    if (this.scrollAnimationFrame) {
      cancelAnimationFrame(this.scrollAnimationFrame);
      this.scrollAnimationFrame = null;
    }
    this.scrollSpeed = 0;
  },

  updateSpeakerAssignment(actionId, newSpeaker) {
    const selectedIds = editorService.selectionManager.getSelectedIds();
    const targetIds = selectedIds.length > 0 ? selectedIds : [actionId];
    this._executeCommand((currentState) => {
      targetIds.forEach((id) => {
        const actionToUpdate = currentState.actions.find((a) => a.id === id);
        if (actionToUpdate) {
          const speakerExists = actionToUpdate.speakers.some(
            (s) => s.characterId === newSpeaker.characterId
          );
          if (!speakerExists) {
            actionToUpdate.speakers.push(newSpeaker);
          }
        }
      });
    });

    // 清除缓存并更新右侧角色列表
    this._invalidateCache();
    const usedIds = this._getUsedCharacterIds();
    this.renderCharacterList(usedIds);

    editorService.clearSelection();
    this.domCache.canvas?.dispatchEvent(
        new CustomEvent("selectionchange", { detail: { selectedIds: [] } })
      );
  },

  removeSpeakerFromAction(actionId, characterIdToRemove) {
    this._executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (action) {
        action.speakers = action.speakers.filter(
          (s) => s.characterId !== characterIdToRemove
        );
      }
    });

    // 清除缓存并更新右侧角色列表
    this._invalidateCache();
    const usedIds = this._getUsedCharacterIds();
    this.renderCharacterList(usedIds);
  },

  removeAllSpeakersFromAction(actionId) {
    this._executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (action) {
        action.speakers = [];
      }
    });

    // 清除缓存并更新右侧角色列表
    this._invalidateCache();
    const usedIds = this._getUsedCharacterIds();
    this.renderCharacterList(usedIds);
  },

  /**
   * 显示多说话人弹出菜单
   * 点击多说话人徽章时触发,显示该对话的所有说话人列表
   * 每个说话人旁边有删除按钮,点击外部自动关闭
   * @param {string} actionId - 动作ID
   * @param {HTMLElement} targetElement - 触发弹出菜单的元素(用于定位)
   */
  showMultiSpeakerPopover(actionId, targetElement) {
    // 移除所有旧的 popover 防止内存泄漏
    DOMUtils.getElements("#speaker-popover").forEach(p => p.remove());

    const action = this.projectFileState.actions.find((a) => a.id === actionId);
    if (!action) return;

    // 使用 DOMUtils 创建 popover
    const popover = DOMUtils.createElement("div", {
      id: "speaker-popover",
      style: {
        position: "fixed",
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
        zIndex: "10001",
        padding: "8px",
        minWidth: "150px",
      },
    });

    // 为每个说话人创建列表项
    const items = action.speakers.map((speaker) => {
      const nameSpan = DOMUtils.createElement("span", {
        style: { flexGrow: "1" },
      }, speaker.name);

      const deleteBtn = DOMUtils.createElement("button", {
        className: "speaker-delete-btn",
        style: {
          border: "none",
          background: "#f1f5f9",
          color: "#64748b",
          borderRadius: "50%",
          width: "22px",
          height: "22px",
          cursor: "pointer",
          marginLeft: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "16px",
          lineHeight: "1",
          transition: "all 0.2s ease",
        },
        onMouseover: (e) => {
          e.currentTarget.style.background = "#fee2e2";
          e.currentTarget.style.color = "#ef4444";
        },
        onMouseout: (e) => {
          e.currentTarget.style.background = "#f1f5f9";
          e.currentTarget.style.color = "#64748b";
        },
        onClick: (e) => {
          e.stopPropagation();
          this.removeSpeakerFromAction(actionId, speaker.characterId);
          popover.remove();
        },
      }, "×");

      return DOMUtils.createElement("div", {
        style: {
          display: "flex",
          alignItems: "center",
          padding: "6px 8px",
          borderRadius: "5px",
        },
      }, [nameSpan, deleteBtn]);
    });

    // 批量添加所有列表项
    DOMUtils.appendChildren(popover, items);
    document.body.appendChild(popover);

    // 定位 popover
    const rect = targetElement.getBoundingClientRect();
    popover.style.top = `${rect.bottom + 5}px`;
    popover.style.left = `${rect.left}px`;

    // 点击外部关闭
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

  async save() {
    await EditorHelper.saveEditor({
      editor: baseEditor,
      modalId: "speakerEditorModal",
      buttonId: "saveSpeakersBtn",
      applyChanges: () => {
        editorService.projectManager.save(this.projectFileState, (savedState) => {
          baseEditor.originalStateOnOpen = JSON.stringify(savedState);
        });
      },
    });
  },

  exportProject() {
    editorService.projectManager.export(this.projectFileState);
  },

  async importProject() {
    const importedProject = await editorService.projectManager.import();
    if (importedProject) {
      this.projectFileState = importedProject;
      this.originalStateOnOpen = JSON.stringify(importedProject);
      editorService.setProjectState(DataUtils.deepClone(importedProject));
      historyManager.clear();
      const usedIds = this.renderCanvas();
      this.renderCharacterList(usedIds);
    }
  },

  async reset() {
    if (!confirm("确定要恢复默认说话人吗？此操作可以撤销。")) {
      return;
    }

    const resetBtn = document.getElementById("resetSpeakersBtn");
    const originalText = resetBtn?.textContent;
    if (resetBtn) resetBtn.textContent = "恢复中...";

    try {
      const rawText = document.getElementById("inputText").value;
      const response = await axios.post("/api/segment-text", { text: rawText });
      const defaultState = this.createProjectFileFromSegments(response.data.segments);

      this._executeCommand((currentState) => {
        // 将 defaultState 的所有属性复制到 currentState
        Object.assign(currentState, defaultState);
      });

      // 重新附加选择功能
      const canvas = this.domCache.canvas;
      if (canvas) {
        editorService.detachSelection(canvas);
        editorService.attachSelection(canvas, ".dialogue-item");
      }

      ui.showStatus("已恢复默认说话人。", "success");
    } catch (error) {
      ui.showStatus(`恢复失败: ${error.message}`, "error");
    } finally {
      if (resetBtn && originalText) resetBtn.textContent = originalText;
    }
  },
};
