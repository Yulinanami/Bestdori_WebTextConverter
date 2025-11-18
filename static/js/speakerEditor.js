import { ui, renderGroupedView } from "./uiUtils.js";
import { editorService } from "./services/EditorService.js";
import { DataUtils } from "./utils/DataUtils.js";
import { DOMUtils } from "./utils/DOMUtils.js";
import { BaseEditor } from "./utils/BaseEditor.js";
import { DragHelper } from "./utils/DragHelper.js";
import { EditorHelper } from "./utils/EditorHelper.js";
import { storageService, STORAGE_KEYS } from "./services/StorageService.js";
import { modalService } from "./services/ModalService.js";
import { BaseEditorMixin } from "./mixins/BaseEditorMixin.js";
import { EventHandlerMixin } from "./mixins/EventHandlerMixin.js";
import { LayoutPropertyMixin } from "./mixins/LayoutPropertyMixin.js";
import { ScrollAnimationMixin } from "./mixins/ScrollAnimationMixin.js";
import { CharacterListMixin } from "./mixins/CharacterListMixin.js";

// 创建基础编辑器实例
const baseEditor = new BaseEditor({
  renderCallback: () => {
    const usedIds = speakerEditor.renderCanvas();
    speakerEditor.renderCharacterList(usedIds);
    speakerEditor._reattachSelection(); // 重新绑定选择功能
  },
  groupSize: 50,
});

export const speakerEditor = {
  baseEditor,
  modalId: "speakerEditorModal",
  saveButtonId: "saveSpeakersBtn",
  importButtonId: "importProjectBtn",
  exportButtonId: "exportProjectBtn",
  characterListId: "speakerEditorCharacterList",

  // 使用 baseEditor 代理状态管理
  get projectFileState() {
    return baseEditor.projectFileState;
  },

  set projectFileState(value) {
    baseEditor.projectFileState = value;
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

  // 多选模式切换按钮
  isMultiSelectMode: false,
  isTextEditMode: false,
  // DOM 缓存
  domCache: {},

  // 初始化编辑器，绑定事件监听器和快捷键
  init() {
    // 缓存 DOM 元素
    this.domCache = {
      groupCheckbox: document.getElementById("groupCardsCheckbox"),
      canvas: document.getElementById("speakerEditorCanvas"),
      characterList: document.getElementById("speakerEditorCharacterList"),
      modal: document.getElementById("speakerEditorModal"),
      undoBtn: document.getElementById("undoBtn"),
      redoBtn: document.getElementById("redoBtn"),
      toggleMultiSelectBtn: document.getElementById("toggleMultiSelectBtn"),
      toggleTextEditBtn: document.getElementById("toggleTextEditBtn"),
    };

    // 从本地存储加载多选模式配置
    const savedMode = storageService.get(
      STORAGE_KEYS.SPEAKER_MULTI_SELECT_MODE
    );
    this.isMultiSelectMode = savedMode === true;

    // 从本地存储加载文本编辑模式配置
    const savedTextEditMode = storageService.get(
      STORAGE_KEYS.SPEAKER_TEXT_EDIT_MODE
    );
    this.isTextEditMode = savedTextEditMode === true;

    document
      .getElementById("openSpeakerEditorBtn")
      ?.addEventListener("click", () => this.open());
    document
      .getElementById("resetSpeakersBtn")
      ?.addEventListener("click", () => this.reset());
    this.domCache.toggleMultiSelectBtn?.addEventListener("click", () =>
      this._toggleMultiSelectMode()
    );
    this.domCache.toggleTextEditBtn?.addEventListener("click", () =>
      this._toggleTextEditMode()
    );

    // 初始化通用事件
    this.initCommonEvents();

    // 初始化置顶按钮处理
    this.initPinButtonHandler();

    if (this.domCache.modal) {
      this.domCache.modal.focus();
    }
  },

  /**
   * 切换多选模式的状态和UI
   */
  _toggleMultiSelectMode() {
    this.isMultiSelectMode = !this.isMultiSelectMode;
    storageService.set(
      STORAGE_KEYS.SPEAKER_MULTI_SELECT_MODE,
      this.isMultiSelectMode
    );
    const btn = this.domCache.toggleMultiSelectBtn;
    if (btn) {
      if (this.isMultiSelectMode) {
        btn.textContent = "多选: 开";
      } else {
        btn.textContent = "多选: 关";
      }
    }
    // 切换模式时清空当前选择，避免混淆
    editorService.clearSelection();
    this.domCache.canvas?.dispatchEvent(
      new CustomEvent("selectionchange", { detail: { selectedIds: [] } })
    );
  },

  /**
   * 切换文本编辑模式的状态和UI
   */
  _toggleTextEditMode() {
    this.isTextEditMode = !this.isTextEditMode;
    // 将新状态保存到本地存储
    storageService.set(
      STORAGE_KEYS.SPEAKER_TEXT_EDIT_MODE,
      this.isTextEditMode
    );

    const btn = this.domCache.toggleTextEditBtn;
    if (btn) {
      btn.textContent = this.isTextEditMode ? "编辑: 开" : "编辑: 关";
    }

    // 在画布容器上切换一个CSS类，用于控制所有编辑按钮的显隐
    this.domCache.canvas.classList.toggle(
      "text-edit-mode-active",
      this.isTextEditMode
    );
  },

  /**
   * 处理点击编辑按钮后的逻辑
   * @param {string} actionId - 被点击卡片对应的动作ID
   */
  _handleTextEdit(actionId) {
    const action = this.projectFileState.actions.find((a) => a.id === actionId);
    if (!action) return;
    const newText = prompt("编辑对话内容:", action.text);

    if (newText !== null && newText.trim() !== action.text.trim()) {
      const trimmedText = newText.trim();
      // 使用 _executeCommand 来执行修改，以便支持撤销/恢复
      baseEditor.executeCommand((currentState) => {
        const actionToUpdate = currentState.actions.find(
          (a) => a.id === actionId
        );

        if (actionToUpdate) {
          actionToUpdate.text = trimmedText;
        }
      });
    }
  },

  /**
   * 处理卡片点击事件，根据多选模式执行不同操作
   * @param {MouseEvent} e - 点击事件对象
   */
  _handleCardClick(e) {
    const editBtn = e.target.closest(".edit-text-btn");
    if (editBtn) {
      e.stopPropagation();
      const card = editBtn.closest(".dialogue-item");
      if (card && card.dataset.id) this._handleTextEdit(card.dataset.id);
      return;
    }

    // 处理添加按钮点击
    const addBtn = e.target.closest(".add-text-btn");
    if (addBtn) {
      e.stopPropagation();
      const card = addBtn.closest(".dialogue-item");
      if (card && card.dataset.id) this._handleCardAdd(card.dataset.id);
      return;
    }

    // 处理删除按钮点击
    const deleteBtn = e.target.closest(".delete-text-btn");
    if (deleteBtn) {
      e.stopPropagation();
      const card = deleteBtn.closest(".dialogue-item");
      if (card && card.dataset.id) this._handleCardDelete(card.dataset.id);
      return;
    }

    const deleteButton = e.target.closest(".layout-remove-btn");
    if (deleteButton) {
      const layoutCard = deleteButton.closest(".layout-item");
      if (layoutCard && layoutCard.dataset.id) {
        this._deleteLayoutAction(layoutCard.dataset.id);
        return;
      }
    }
    const item = e.target.closest(".dialogue-item, .layout-item");
    if (!item || !item.dataset.id) return;
    const id = item.dataset.id;

    if (this.isMultiSelectMode) {
      editorService.selectionManager.toggle(id);
    } else {
      if (e.ctrlKey || e.metaKey) {
        editorService.selectionManager.toggle(id);
      } else if (e.shiftKey) {
        editorService.selectionManager.selectRange(
          id,
          this.domCache.canvas,
          ".dialogue-item, .layout-item"
        );
      } else {
        const isAlreadyOnlySelected =
          editorService.selectionManager.selectedIds.has(id) &&
          editorService.selectionManager.selectedIds.size === 1;
        if (isAlreadyOnlySelected) {
          editorService.selectionManager.clear();
        } else {
          editorService.selectionManager.selectSingle(id);
        }
      }
    }

    editorService.selectionManager.lastSelectedId =
      editorService.selectionManager.selectedIds.has(id) ? id : null;
    this.domCache.canvas.dispatchEvent(
      new CustomEvent("selectionchange", {
        detail: {
          selectedIds: editorService.selectionManager.getSelectedIds(),
        },
      })
    );
  },

  /**
   * 处理删除对话卡片的逻辑
   * @param {string} actionId - 被点击卡片对应的动作ID
   */
  async _handleCardDelete(actionId) {
    const action = this.projectFileState.actions.find((a) => a.id === actionId);
    if (!action) return;

    const confirmed = await modalService.confirm(
      `确定要删除这条对话吗？\n\n"${action.text.substring(0, 50)}..."`
    );
    if (confirmed) {
      baseEditor.executeCommand((currentState) => {
        const index = currentState.actions.findIndex((a) => a.id === actionId);
        if (index > -1) {
          currentState.actions.splice(index, 1);
        }
      });
    }
  },

  /**
   * 处理在当前卡片下方添加新对话卡片的逻辑
   * @param {string} actionId - 被点击卡片对应的动作ID
   */
  async _handleCardAdd(actionId) {
    const newText = await modalService.prompt("请输入新对话的内容：");
    if (newText && newText.trim()) {
      const trimmedText = newText.trim();
      baseEditor.executeCommand((currentState) => {
        const currentIndex = currentState.actions.findIndex(
          (a) => a.id === actionId
        );
        if (currentIndex > -1) {
          const newAction = {
            id: `action-id-${Date.now()}-${Math.random()}`,
            type: "talk",
            text: trimmedText,
            speakers: [],
            characterStates: {},
          };
          currentState.actions.splice(currentIndex + 1, 0, newAction);
        }
      });
    }
  },

  // 根据 Y 坐标查找最接近的对话卡片（用于拖拽插入位置计算）
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

  // 重新附加卡片选择功能
  _reattachSelection() {
    const canvas = this.domCache.canvas;
    if (canvas) {
      if (this._boundCardClickHandler) {
        canvas.removeEventListener("click", this._boundCardClickHandler);
      }
      editorService.clearSelection();
      if (!this._boundCardClickHandler) {
        this._boundCardClickHandler = this._handleCardClick.bind(this);
      }
      canvas.addEventListener("click", this._boundCardClickHandler);
    }
  },

  /**
   * 获取所有已使用的角色名称
   * @returns {Set<string>} 角色名称集合
   */
  _getUsedCharacterIds() {
    const usedNames = new Set();
    if (this.projectFileState && this.projectFileState.actions) {
      this.projectFileState.actions.forEach((action) => {
        // 添加 action 存在性检查，防止数组中有 undefined 元素
        if (action && action.type === "talk" && action.speakers) {
          action.speakers.forEach((speaker) => {
            if (speaker.name) {
              usedNames.add(speaker.name);
            }
          });
        }
      });
    }
    return usedNames;
  },

  // 打开对话编辑器模态框
  async open() {
    await EditorHelper.openEditor({
      editor: baseEditor,
      modalId: "speakerEditorModal",
      buttonId: "openSpeakerEditorBtn",
      loadingText: "加载中...",
      beforeOpen: async () => {
        try {
          await this._prepareProjectState({
            onExistingProjectLoaded: () =>
              ui.showStatus("已加载现有项目进度。", "info"),
            onNewProjectCreated: (_, { rawText }) => {
              if (rawText?.trim()) {
                ui.showStatus("已根据当前文本创建新项目。", "info");
              }
            },
          });
        } catch (error) {
          ui.showStatus(
            `加载编辑器失败: ${error.response?.data?.error || error.message}`,
            "error"
          );
          throw error;
        }
      },

      afterOpen: async () => {
        if (this.domCache.toggleMultiSelectBtn) {
          this.domCache.toggleMultiSelectBtn.textContent = this
            .isMultiSelectMode
            ? "多选: 开"
            : "多选: 关";
        }

        // 根据加载的状态更新"编辑模式"按钮的UI
        if (this.domCache.toggleTextEditBtn) {
          this.domCache.toggleTextEditBtn.textContent = this.isTextEditMode
            ? "编辑: 开"
            : "编辑: 关";
        }

        this.domCache.canvas.classList.toggle(
          "text-edit-mode-active",
          this.isTextEditMode
        );

        const usedCharacterIds = this.renderCanvas();
        this.renderCharacterList(usedCharacterIds);
        this.initDragAndDrop();

        const canvas = document.getElementById("speakerEditorCanvas");
        editorService.clearSelection();
        if (this._boundCardClickHandler) {
          canvas.removeEventListener("click", this._boundCardClickHandler);
        }
        this._boundCardClickHandler = this._handleCardClick.bind(this);
        canvas.addEventListener("click", this._boundCardClickHandler);
        canvas.addEventListener("selectionchange", (e) => {
          if (!e.detail) {
            return;
          }

          const selectedIds = new Set(e.detail.selectedIds);
          const allCards = canvas.querySelectorAll(
            ".dialogue-item, .layout-item"
          );
          allCards.forEach((card) => {
            if (selectedIds.has(card.dataset.id)) {
              card.classList.add("is-selected");
            } else {
              card.classList.remove("is-selected");
            }
          });
        });

        canvas.addEventListener("change", (e) => {
          const card = e.target.closest(".layout-item");
          if (card && e.target.matches("select, input")) {
            LayoutPropertyMixin._updateLayoutActionProperty.call(
              this,
              card.dataset.id,
              e.target
            );
          }
        });
      },
    });
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

    const usedIds = this._getUsedCharacterIds();
    const isGroupingEnabled = this.domCache.groupCheckbox?.checked || false;
    const actions = this.projectFileState.actions;
    const groupSize = 50;
    const actionIndexMap = new Map(actions.map((a, idx) => [a.id, idx]));

    const talkTemplate = document.getElementById("text-snippet-card-template");
    const layoutTemplate = document.getElementById(
      "timeline-layout-card-template"
    );

    const renderSingleCard = (action) => {
      const globalIndex = actionIndexMap.get(action.id) ?? -1;
      let card;

      if (action.type === "talk") {
        card = talkTemplate.content.cloneNode(true);
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
      } else if (action.type === "layout") {
        card = layoutTemplate.content.cloneNode(true);
        const item = card.querySelector(".timeline-item");
        item.dataset.id = action.id;
        item.dataset.layoutType = action.layoutType;
        item.classList.remove("dialogue-item");
        item.classList.add("layout-item");

        // 根据类型添加样式
        DOMUtils.applyLayoutTypeClass(item, action.layoutType);

        const characterId = action.characterId;
        const characterName =
          action.characterName ||
          editorService.getCharacterNameById(characterId);

        card.querySelector(".speaker-name").textContent =
          characterName || `未知角色 (ID: ${characterId})`;
        const avatarDiv = card.querySelector(".dialogue-avatar");
        editorService.updateCharacterAvatar(
          { querySelector: () => avatarDiv },
          characterId,
          characterName
        );
        // 使用共享的渲染函数（在对话编辑器中隐藏切换按钮）
        this.renderLayoutCardControls(card, action, characterName, {
          showToggleButton: false,
        });
      } else {
        return null;
      }

      const numberDiv = card.querySelector(".card-sequence-number");
      if (numberDiv && globalIndex !== -1) {
        numberDiv.textContent = `#${globalIndex + 1}`;
      }
      return card;
    };

    if (isGroupingEnabled && actions.length > groupSize) {
      renderGroupedView({
        container: canvas,
        actions,
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
        groupSize,
      });
    } else {
      DOMUtils.clearElement(canvas);
      const fragment = document.createDocumentFragment();
      actions.forEach((action) => {
        const renderedCard = renderSingleCard(action);
        if (renderedCard) fragment.appendChild(renderedCard);
      });
      canvas.appendChild(fragment);
    }

    return usedIds;
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
    this.sortableInstances.forEach((instance) => instance?.destroy());
    this.sortableInstances = [];

    // 角色列表的Sortable配置
    this.sortableInstances.push(
      new Sortable(characterList, {
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
          const cardItem = evt.item;
          const actionId = cardItem.dataset.id;

          if (actionId) {
            // 判断被拖入卡片的类型
            if (cardItem.classList.contains("dialogue-item")) {
              this.removeAllSpeakersFromAction(actionId);
            } else if (cardItem.classList.contains("layout-item")) {
              this._deleteLayoutAction(actionId);
            }
          }

          cardItem.remove();
        },
      })
    );
    // 使用 DragHelper 创建 onEnd 处理器（移动现有卡片）
    const onEndHandler = DragHelper.createOnEndHandler({
      editor: baseEditor,
      getGroupingEnabled: () => this.domCache.groupCheckbox?.checked || false,
      groupSize: 50,
      executeFn: (globalOldIndex, globalNewIndex) => {
        baseEditor.executeCommand((currentState) => {
          // 验证索引有效性
          if (
            globalOldIndex < 0 ||
            globalOldIndex >= currentState.actions.length
          ) {
            console.error(
              `Invalid globalOldIndex: ${globalOldIndex}, actions length: ${currentState.actions.length}`
            );
            return;
          }

          const [movedItem] = currentState.actions.splice(globalOldIndex, 1);

          // 验证 movedItem 存在
          if (!movedItem) {
            console.error(`movedItem is undefined at index ${globalOldIndex}`);
            return;
          }

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

    this.sortableInstances.push(
      new Sortable(
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
      )
    );
  },

  handleDragScrolling: (e) => {
    const containers = [
      speakerEditor.domCache.canvas,
      speakerEditor.domCache.characterList,
    ];
    ScrollAnimationMixin.handleDragScrolling.call(speakerEditor, e, containers);
  },

  // 更新对话的说话人分配（支持多选批量分配）
  updateSpeakerAssignment(actionId, newSpeaker) {
    const selectedIds = editorService.selectionManager.getSelectedIds();
    const targetIds = selectedIds.length > 0 ? selectedIds : [actionId];
    baseEditor.executeCommand((currentState) => {
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

    editorService.clearSelection();
    this.domCache.canvas?.dispatchEvent(
      new CustomEvent("selectionchange", { detail: { selectedIds: [] } })
    );
  },

  // 从对话中移除指定说话人
  removeSpeakerFromAction(actionId, characterIdToRemove) {
    baseEditor.executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (action) {
        action.speakers = action.speakers.filter(
          (s) => s.characterId !== characterIdToRemove
        );
      }
    });

  },

  // 清空对话的所有说话人
  removeAllSpeakersFromAction(actionId) {
    baseEditor.executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (action) {
        action.speakers = [];
      }
    });

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
    DOMUtils.getElements("#speaker-popover").forEach((p) => p.remove());

    const action = this.projectFileState.actions.find((a) => a.id === actionId);
    if (!action) return;

    // 使用 DOMUtils 创建 popover
    const popover = DOMUtils.createElement("div", {
      id: "speaker-popover",
      className: "speaker-popover-menu",
      style: {
        position: "fixed",
        borderRadius: "8px",
        boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
        zIndex: "10001",
        padding: "8px",
        minWidth: "150px",
      },
    });

    // 为每个说话人创建列表项
    const items = action.speakers.map((speaker) => {
      const nameSpan = DOMUtils.createElement(
        "span",
        {
          style: { flexGrow: "1" },
        },
        speaker.name
      );

      const deleteBtn = DOMUtils.createElement(
        "button",
        {
          className: "speaker-delete-btn",
          style: {
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
          },
          onClick: (e) => {
            e.stopPropagation();
            this.removeSpeakerFromAction(actionId, speaker.characterId);
            popover.remove();
          },
        },
        "×"
      );

      return DOMUtils.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            padding: "6px 8px",
            borderRadius: "5px",
          },
        },
        [nameSpan, deleteBtn]
      );
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

  // 恢复默认说话人（重新解析文本自动分配说话人）
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
      const defaultState = this._createProjectFileFromSegments(
        response.data.segments
      );
      baseEditor.executeCommand((currentState) => {
        Object.assign(currentState, defaultState);
      });

      ui.showStatus("已恢复默认说话人。", "success");
    } catch (error) {
      ui.showStatus(`恢复失败: ${error.message}`, "error");
    } finally {
      if (resetBtn && originalText) resetBtn.textContent = originalText;
    }
  },

  // 钩子方法
  afterImport() {
    this.renderCanvas();
    const usedCharacterNames = this._getUsedCharacterIds();
    this.renderCharacterList(usedCharacterNames);
  },

  afterPinToggle() {
    const usedCharacterNames = this._getUsedCharacterIds();
    this.renderCharacterList(usedCharacterNames);
  },

  onBeforeClose() {
    editorService.detachSelection(this.domCache.canvas);
  },

  _createActionFromSegment(index, text, speakers) {
    return {
      id: `action-id-${Date.now()}-${index}`,
      type: "talk",
      text: text,
      speakers: speakers,
    };
  },
};

// 使用 Object.assign 继承 mixins
Object.assign(
  speakerEditor,
  BaseEditorMixin,
  EventHandlerMixin,
  LayoutPropertyMixin,
  ScrollAnimationMixin,
  CharacterListMixin
);
