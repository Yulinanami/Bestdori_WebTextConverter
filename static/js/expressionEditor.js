// 动作表情编辑器
import { DataUtils } from "./utils/DataUtils.js";
import { DOMUtils } from "./utils/DOMUtils.js";
import { BaseEditor } from "./utils/BaseEditor.js";
import { DragHelper } from "./utils/DragHelper.js";
import { EditorHelper } from "./utils/EditorHelper.js";
import { ui, renderGroupedView } from "./uiUtils.js";
import { historyManager } from "./historyManager.js";
import { editorService } from "./services/EditorService.js";

// 创建基础编辑器实例
const baseEditor = new BaseEditor({
  renderCallback: () => {
    expressionEditor.renderTimeline();
  },
  groupSize: 50,
});

export const expressionEditor = {
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

  // DOM 缓存
  domCache: {},
  // Sortable 实例管理
  sortableInstances: [],
  // 滚动动画
  scrollAnimationFrame: null,
  scrollSpeed: 0,

  stagedCharacters: [],
  tempLibraryItems: { motion: [], expression: [] },

  init() {
    // 缓存 DOM 元素
    this.domCache = {
      groupCheckbox: document.getElementById("groupCardsCheckbox"),
      timeline: document.getElementById("expressionEditorTimeline"),
      modal: document.getElementById("expressionEditorModal"),
      undoBtn: document.getElementById("expressionUndoBtn"),
      redoBtn: document.getElementById("expressionRedoBtn"),
      motionList: document.getElementById("motionLibraryList"),
      expressionList: document.getElementById("expressionLibraryList"),
    };

    document
      .getElementById("openExpressionEditorBtn")
      ?.addEventListener("click", () => this.open());
    document
      .getElementById("saveExpressionsBtn")
      ?.addEventListener("click", () => this.save());
    document
      .getElementById("importExpressionsBtn")
      ?.addEventListener("click", () => this.importProject());
    document
      .getElementById("exportExpressionsBtn")
      ?.addEventListener("click", () => this.exportProject());
    document
      .getElementById("resetExpressionsBtn")
      ?.addEventListener("click", () => this.reset());
    this.domCache.undoBtn?.addEventListener("click", () => historyManager.undo());
    this.domCache.redoBtn?.addEventListener("click", () => historyManager.redo());
    document
      .getElementById("addTempMotionBtn")
      ?.addEventListener("click", () => this._addTempItem("motion"));
    document
      .getElementById("addTempExpressionBtn")
      ?.addEventListener("click", () => this._addTempItem("expression"));
    document
      .getElementById("live2dViewerBtn")
      ?.addEventListener("click", () => this._openLive2dViewers());
    const setupSearchClear = (inputId, clearBtnId) => {
      const input = document.getElementById(inputId);
      const clearBtn = document.getElementById(clearBtnId);
      if (!input || !clearBtn) return;
      input.addEventListener("input", () => {
        clearBtn.style.display = input.value ? "block" : "none";
      });
      clearBtn.addEventListener("click", () => {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      });
    };
    setupSearchClear("motionSearchInput", "clearMotionSearchBtn");
    setupSearchClear("expressionSearchInput", "clearExpressionSearchBtn");
    document
      .getElementById("motionSearchInput")
      ?.addEventListener("input", (e) => this._filterLibraryList("motion", e));
    document
      .getElementById("expressionSearchInput")
      ?.addEventListener("input", (e) =>
        this._filterLibraryList("expression", e)
      );
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
    this.domCache.modal
      ?.querySelector(".modal-close")
      ?.addEventListener("click", handleCloseAttempt);
    document.addEventListener("historychange", (e) => {
      if (this.domCache.modal?.style.display === "flex") {
        if (this.domCache.undoBtn) this.domCache.undoBtn.disabled = !e.detail.canUndo;
        if (this.domCache.redoBtn) this.domCache.redoBtn.disabled = !e.detail.canRedo;
      }
    });
    this.domCache.modal?.addEventListener("keydown", (e) => {
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

  handleDragScrolling: (e) => {
    const timeline = expressionEditor.domCache.timeline;
    const motionList = expressionEditor.domCache.motionList;
    const expressionList = expressionEditor.domCache.expressionList;
    if (!timeline || !motionList || !expressionList) return;

    let scrollTarget = null;
    if (timeline.contains(e.target)) {
      scrollTarget = timeline;
    } else if (motionList.contains(e.target)) {
      scrollTarget = motionList;
    } else if (expressionList.contains(e.target)) {
      scrollTarget = expressionList;
    }

    if (!scrollTarget) {
      expressionEditor.stopScrolling();
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
      if (newScrollSpeed !== expressionEditor.scrollSpeed || !expressionEditor.scrollAnimationFrame) {
        expressionEditor.scrollSpeed = newScrollSpeed;
        expressionEditor.startScrolling(scrollTarget);
      }
    } else {
      expressionEditor.stopScrolling();
    }
  },

  // 使用 requestAnimationFrame 优化滚动性能
  startScrolling(elementToScroll) {
    this.stopScrolling();

    const scroll = () => {
      if (elementToScroll && this.scrollSpeed !== 0) {
        elementToScroll.scrollTop += this.scrollSpeed;
        this.scrollAnimationFrame = requestAnimationFrame(scroll);
      }
    };
    scroll();
  },

  // 停止自动滚动动画
  stopScrolling() {
    if (this.scrollAnimationFrame) {
      cancelAnimationFrame(this.scrollAnimationFrame);
      this.scrollAnimationFrame = null;
    }
    this.scrollSpeed = 0;
  },

  // 执行角色状态属性变更命令（支持撤销/重做）
  _executePropertyChangeCommand(actionId, characterName, type, newValue) {
    let oldValue = "--";
    const action = this.projectFileState.actions.find((a) => a.id === actionId);
    if (!action) return;
    if (action.type === "talk" && action.characterStates) {
      const character = this.stagedCharacters.find(
        (c) => c.name === characterName
      );
      if (character && action.characterStates[character.id]) {
        oldValue = action.characterStates[character.id][type] || "--";
      }
    } else if (
      action.type === "layout" &&
      action.characterName === characterName
    ) {
      oldValue = action.initialState ? action.initialState[type] || "--" : "--";
    }
    if (oldValue === newValue) return;
    const command = {
      execute: () => {
        this._applyCharacterStateChange(
          actionId,
          characterName,
          type,
          newValue
        );
        this._updateSingleTagUI(actionId, characterName, type, newValue);
      },
      undo: () => {
        this._applyCharacterStateChange(
          actionId,
          characterName,
          type,
          oldValue
        );
        this._updateSingleTagUI(actionId, characterName, type, oldValue);
      },
    };
    historyManager.do(command);
  },

  // 应用角色状态变更到项目数据
  _applyCharacterStateChange(actionId, characterName, type, value) {
    const action = this.projectFileState.actions.find((a) => a.id === actionId);
    if (!action) return;
    const valueToStore = value === "--" ? "" : value;
    if (action.type === "talk") {
      if (!action.characterStates) action.characterStates = {};
      const character = this.stagedCharacters.find(
        (c) => c.name === characterName
      );
      if (!character) {
        console.error(`无法为角色 "${characterName}" 找到ID，状态未更新。`);
        return;
      }
      const characterId = character.id;
      if (!action.characterStates[characterId])
        action.characterStates[characterId] = {};
      action.characterStates[characterId][type] = valueToStore;
    } else if (
      action.type === "layout" &&
      action.characterName === characterName
    ) {
      if (!action.initialState) action.initialState = {};
      action.initialState[type] = valueToStore;
    }
  },

  // 更新单个角色状态标签的 UI 显示
  _updateSingleTagUI(actionId, characterName, type, value) {
    const timelineItem = document.querySelector(
      `.timeline-item[data-id="${actionId}"]`
    );
    if (!timelineItem) return;
    const statusTag = timelineItem.querySelector(
      `.character-status-tag[data-character-name="${characterName}"]`
    );
    if (!statusTag) return;
    const dropZone = statusTag.querySelector(`.${type}-drop-zone`);
    if (dropZone) {
      dropZone.querySelector(".drop-zone-value").textContent = value;
      const clearBtn = dropZone.querySelector(".clear-state-btn");
      if (clearBtn) {
        DOMUtils.toggleDisplay(clearBtn, value && value !== "--");
      }
    }
  },

  // 保存表情动作配置到全局状态
  async save() {
    await EditorHelper.saveEditor({
      editor: baseEditor,
      modalId: "expressionEditorModal",
      buttonId: "saveExpressionsBtn",
      applyChanges: () => {
        editorService.projectManager.save(this.projectFileState, (savedState) => {
          baseEditor.originalStateOnOpen = JSON.stringify(savedState);
        });
      },
    });
  },

  // 导出项目文件
  exportProject() {
    editorService.projectManager.export(this.projectFileState);
  },

  // 导入项目文件
  async importProject() {
    const importedProject = await editorService.projectManager.import();
    if (importedProject) {
      this.projectFileState = importedProject;
      this.originalStateOnOpen = JSON.stringify(importedProject);
      editorService.setProjectState(DataUtils.deepClone(importedProject));
      historyManager.clear();
      this.stagedCharacters = this._calculateStagedCharacters(
        this.projectFileState
      );
      this.renderTimeline();
    }
  },

  // 恢复默认表情动作（清空所有角色状态配置）
  async reset() {
    if (!confirm("确定要恢复默认表情动作吗？此操作可以撤销。")) {
      return;
    }

    const resetBtn = document.getElementById("resetExpressionsBtn");
    const originalText = resetBtn?.textContent;
    if (resetBtn) resetBtn.textContent = "恢复中...";

    try {
      this._executeCommand((currentState) => {
        currentState.actions.forEach((action) => {
          if (action.type === "talk") action.characterStates = {};
          else if (action.type === "layout") action.initialState = {};
        });
      });
      ui.showStatus("已恢复默认表情动作。", "success");
    } finally {
      if (resetBtn && originalText) resetBtn.textContent = originalText;
    }
  },

  // 打开表情动作编辑器模态框
  async open() {
    await EditorHelper.openEditor({
      editor: baseEditor,
      modalId: "expressionEditorModal",
      buttonId: "openExpressionEditorBtn",
      loadingText: "加载中...",
      beforeOpen: async () => {
        try {
          this.tempLibraryItems = { motion: [], expression: [] };
          let initialState;
          const rawText = document.getElementById("inputText").value;
          const projectState = editorService.getProjectState();
          if (projectState) {
            initialState = projectState;
          } else {
            const response = await axios.post("/api/segment-text", {
              text: rawText,
            });
            initialState = this._createProjectFileFromSegments(
              response.data.segments
            );
          }
          this.projectFileState = DataUtils.deepClone(initialState);
          this.originalStateOnOpen = JSON.stringify(this.projectFileState);
          this.stagedCharacters = this._calculateStagedCharacters(
            this.projectFileState
          );
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
        const motionSearch = document.getElementById("motionSearchInput");
        const expressionSearch = document.getElementById("expressionSearchInput");
        if (motionSearch) motionSearch.value = "";
        if (expressionSearch) expressionSearch.value = "";
        this.renderTimeline();
        this.domCache.modal?.focus();
        const timeline = this.domCache.timeline;

        timeline.onclick = (e) => {
          const card = e.target.closest(".timeline-item");
          if (!card) return;
          if (e.target.matches(".setup-expressions-btn")) {
            this.showExpressionSetupUI(card);
            return;
          }
          if (e.target.matches(".clear-state-btn")) {
            const dropZone = e.target.closest(".drop-zone");
            const statusTag = e.target.closest(".character-status-tag");
            if (dropZone && statusTag) {
              const actionId = card.dataset.id;
              const characterName = statusTag.dataset.characterName;
              const type = dropZone.dataset.type;
              this._executePropertyChangeCommand(
                actionId,
                characterName,
                type,
                "--"
              );
            }
            return;
          }
          if (e.target.matches(".layout-remove-btn")) {
            this._deleteLayoutAction(card.dataset.id);
            return;
          }
        };

        timeline.onchange = (e) => {
          const card = e.target.closest(".layout-item");
          if (card && e.target.matches("select, input")) {
            this._updateLayoutActionProperty(card.dataset.id, e.target);
          }
        };

        // 使用 DragHelper 创建 onEnd 处理器
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

        // 清理旧的 Sortable 实例
        this.sortableInstances.forEach(instance => instance?.destroy());
        this.sortableInstances = [];

        this.sortableInstances.push(new Sortable(
          timeline,
          DragHelper.createSortableConfig({
            group: "timeline-cards",
            onEnd: (evt) => {
              document.removeEventListener("dragover", this.handleDragScrolling);
              this.stopScrolling();
              onEndHandler(evt);
            },
            extraConfig: {
              sort: true,
              onStart: () => {
                document.addEventListener("dragover", this.handleDragScrolling);
              },
            },
          })
        ));

        // 渲染资源库并初始化拖放（必须在渲染后初始化）
        this.renderLibraries();
      },
    });
  },

  // 使用 BaseEditor 的 getGlobalIndex 方法
  _getGlobalIndex(localIndex) {
    const isGroupingEnabled = this.domCache.groupCheckbox?.checked || false;
    return baseEditor.getGlobalIndex(localIndex, isGroupingEnabled);
  },

  /**
   * 根据输入内容过滤资源库列表
   * @param {'motion' | 'expression'} type - 要过滤的列表类型
   * @param {Event} event - input事件对象
   */
  _filterLibraryList(type, event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    const listContainerId =
      type === "motion" ? "motionLibraryList" : "expressionLibraryList";
    const listContainer = document.getElementById(listContainerId);
    if (!listContainer) return;
    const items = listContainer.querySelectorAll(
      ".config-list-item.draggable-item"
    );
    items.forEach((item) => {
      const itemName = item.textContent.toLowerCase();
      if (itemName.startsWith(searchTerm)) {
        item.style.display = "";
      } else {
        item.style.display = "none";
      }
    });
  },

  // 显示卡片的表情设置 UI（展开状态栏）
  showExpressionSetupUI(cardElement) {
    const actionId = cardElement.dataset.id;
    const action = this.projectFileState.actions.find((a) => a.id === actionId);
    if (!action) return;
    const footer = cardElement.querySelector(".timeline-item-footer");
    if (!footer) return;
    const statusBar = this._renderStatusBarForAction(action);
    DOMUtils.clearElement(footer);
    footer.appendChild(statusBar);
    this._initSortableForZones(statusBar);
  },

  // 检查动作是否包含表情数据（characterStates 或 initialState）
  _actionHasExpressionData(action) {
    if (action.type === "talk") {
      return (
        action.characterStates && Object.keys(action.characterStates).length > 0
      );
    }
    if (action.type === "layout") {
      return action.initialState && Object.keys(action.initialState).length > 0;
    }
    return false;
  },

  // 为状态栏的拖放区域初始化 Sortable（接受动作/表情拖放）
  _initSortableForZones(parentElement) {
    parentElement.querySelectorAll(".drop-zone").forEach((zone) => {
      new Sortable(zone, {
        group: {
          name: zone.dataset.type,
          put: function (to, from, dragEl) {
            return dragEl.classList.contains("draggable-item");
          },
        },
        animation: 150,
        onAdd: (evt) => {
          const value = evt.item ? evt.item.textContent : null;
          const dropZone = evt.to;
          const statusTag = dropZone.closest(".character-status-tag");
          const timelineItem = dropZone.closest(".timeline-item");
          if (value && statusTag && timelineItem) {
            const characterName = statusTag.dataset.characterName;
            const actionId = timelineItem.dataset.id;
            const type = dropZone.dataset.type;
            this._executePropertyChangeCommand(
              actionId,
              characterName,
              type,
              value
            );
          }
          evt.item.remove();
        },
      });
    });
  },

  // 初始化动作和表情资源库的拖放功能
  initDragAndDropForLibraries() {
    // 先销毁资源库相关的 Sortable 实例（只保留 timeline 的实例）
    const timelineSortable = this.sortableInstances[0]; // timeline 的实例是第一个
    this.sortableInstances.slice(1).forEach(instance => instance?.destroy());
    this.sortableInstances = timelineSortable ? [timelineSortable] : [];

    ["motion", "expression"].forEach((type) => {
      const libraryList = type === "motion" ? this.domCache.motionList : this.domCache.expressionList;
      if (libraryList) {
        this.sortableInstances.push(new Sortable(libraryList, {
          group: { name: type, pull: "clone", put: false },
          sort: false,
          onStart: () => {
            document.addEventListener("dragover", this.handleDragScrolling);
          },
          onEnd: () => {
            document.removeEventListener("dragover", this.handleDragScrolling);
            this.stopScrolling();
          },
        }));
      }
    });
  },

  // 计算当前在场的角色列表（根据 layout 动作的 appear 事件）
  _calculateStagedCharacters(projectFile) {
    const appearedCharacterNames = new Set();
    const characters = [];
    projectFile.actions.forEach((action) => {
      if (action.type === "layout" && action.layoutType === "appear") {
        const charName =
          action.characterName ||
          editorService.getCharacterNameById(action.characterId);
        if (charName && !appearedCharacterNames.has(charName)) {
          appearedCharacterNames.add(charName);
          characters.push({
            id: action.characterId,
            name: charName,
          });
        }
      }
    });
    return characters;
  },

  /**
   * 渲染表情编辑器时间轴
   * 渲染两种类型的卡片:
   * - talk卡片: 显示对话内容,可设置每个登场角色的动作/表情
   * - layout卡片: Live2D布局动作(登场/移动/退场),可编辑位置和服装
   * 支持分组模式(50条/组)和普通模式,自动显示卡片序号和表情设置状态
   */
  renderTimeline() {
    const timeline = this.domCache.timeline;
    if (!timeline) return;

    const talkTemplate = document.getElementById("timeline-talk-card-template");
    const layoutTemplate = document.getElementById(
      "timeline-layout-card-template"
    );
    const isGroupingEnabled = this.domCache.groupCheckbox?.checked || false;
    const actions = this.projectFileState.actions;
    const groupSize = 50;

    // 创建索引缓存 Map
    const actionIndexMap = new Map(
      this.projectFileState.actions.map((a, idx) => [a.id, idx])
    );

    const renderSingleCard = (action) => {
      const globalIndex = actionIndexMap.get(action.id) ?? -1;
      let card;
      if (action.type === "talk") {
        card = talkTemplate.content.cloneNode(true);
        const item = card.querySelector(".timeline-item");
        item.dataset.id = action.id;
        const nameDiv = card.querySelector(".speaker-name");
        const avatarDiv = card.querySelector(".dialogue-avatar");
        if (action.speakers && action.speakers.length > 0) {
          const firstSpeaker = action.speakers[0];
          nameDiv.textContent = action.speakers.map((s) => s.name).join(" & ");
          editorService.updateCharacterAvatar(
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
      } else if (action.type === "layout") {
        card = layoutTemplate.content.cloneNode(true);
        const item = card.querySelector(".timeline-item");
        item.dataset.id = action.id;
        item.dataset.layoutType = action.layoutType;
        item.classList.remove(
          "layout-type-appear",
          "layout-type-move",
          "layout-type-hide"
        );
        if (action.layoutType === "appear") {
          item.classList.add("layout-type-appear");
        } else if (action.layoutType === "move") {
          item.classList.add("layout-type-move");
        } else if (action.layoutType === "hide") {
          item.classList.add("layout-type-hide");
        }
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
        DOMUtils.clearElement(costumeSelect);
        const availableCostumes =
          editorService.costumeManager.availableCostumes[characterName] || [];
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
        DOMUtils.clearElement(positionSelect);
        DOMUtils.clearElement(toPositionSelect);
        Object.entries(editorService.positionManager.positionNames).forEach(
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
      } else {
        return null;
      }
      const numberDiv = card.querySelector(".card-sequence-number");
      if (numberDiv && globalIndex !== -1) {
        numberDiv.textContent = `#${globalIndex + 1}`;
      }
      const footer = card.querySelector(".timeline-item-footer");
      if (this._actionHasExpressionData(action)) {
        const statusBar = this._renderStatusBarForAction(action);
        footer.appendChild(statusBar);
        this._initSortableForZones(statusBar);
      } else {
        const setupButton = DOMUtils.createButton(
          "设置动作/表情",
          "btn btn-secondary btn-sm setup-expressions-btn"
        );
        footer.appendChild(setupButton);
      }
      return card;
    };

    if (isGroupingEnabled && actions.length > groupSize) {
      renderGroupedView({
        container: timeline,
        actions: actions,
        activeGroupIndex: this.activeGroupIndex,
        onGroupClick: (index) => {
          const isOpening = this.activeGroupIndex !== index;
          this.activeGroupIndex = isOpening ? index : null;
          this.renderTimeline();

          if (isOpening) {
            setTimeout(() => {
              const scrollContainer = this.domCache.timeline;
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
      DOMUtils.clearElement(timeline);
      const fragment = document.createDocumentFragment();
      actions.forEach((action) => {
        const card = renderSingleCard(action);
        if (card) fragment.appendChild(card);
      });
      timeline.appendChild(fragment);
    }
  },

  /**
   * 为动作渲染角色状态栏
   * 根据动作类型渲染:
   * - talk动作: 为所有登场角色创建状态标签
   * - layout动作: 为该布局涉及的角色创建状态标签
   * 每个状态标签包含角色头像、名称、动作/表情拖放区和清除按钮
   * @param {Object} action - 动作对象
   * @returns {HTMLElement} 状态栏DOM元素
   */
  _renderStatusBarForAction(action) {
    const statusTagTemplate = document.getElementById(
      "character-status-tag-template"
    );
    const statusBar = DOMUtils.createElement("div", {
      className: "character-status-bar",
    });
    if (action.type === "talk") {
      this.stagedCharacters.forEach((char) => {
        const tag = statusTagTemplate.content.cloneNode(true);
        const statusTagElement = tag.querySelector(".character-status-tag");
        statusTagElement.dataset.characterId = char.id;
        statusTagElement.dataset.characterName = char.name;

        const avatarDiv = tag.querySelector(".dialogue-avatar");
        editorService.updateCharacterAvatar(
          { querySelector: () => avatarDiv },
          char.id,
          char.name
        );
        tag.querySelector(".character-name").textContent = char.name;
        const currentState = action.characterStates?.[char.id] || {};
        const currentMotion = currentState.motion || "--";
        const currentExpression = currentState.expression || "--";
        const motionValue = tag.querySelector(
          ".motion-drop-zone .drop-zone-value"
        );
        const motionClearBtn = tag.querySelector(
          ".motion-drop-zone .clear-state-btn"
        );
        motionValue.textContent = currentMotion;
        if (motionClearBtn)
          DOMUtils.toggleDisplay(motionClearBtn, currentMotion !== "--");
        const expValue = tag.querySelector(
          ".expression-drop-zone .drop-zone-value"
        );
        const expClearBtn = tag.querySelector(
          ".expression-drop-zone .clear-state-btn"
        );
        expValue.textContent = currentExpression;
        if (expClearBtn)
          DOMUtils.toggleDisplay(expClearBtn, currentExpression !== "--");
        statusBar.appendChild(tag);
      });
    } else if (action.type === "layout") {
      const char = {
        id: action.characterId,
        name:
          action.characterName ||
          editorService.getCharacterNameById(action.characterId),
      };
      if (!char.name) return statusBar;
      const tag = statusTagTemplate.content.cloneNode(true);
      const statusTagElement = tag.querySelector(".character-status-tag");
      statusTagElement.dataset.characterId = char.id;
      statusTagElement.dataset.characterName = char.name;
      const avatarDiv = tag.querySelector(".dialogue-avatar");
      editorService.updateCharacterAvatar(
        { querySelector: () => avatarDiv },
        char.id,
        char.name
      );
      tag.querySelector(".character-name").textContent = char.name;
      const currentState = action.initialState || {};
      const currentMotion = currentState.motion || "--";
      const currentExpression = currentState.expression || "--";
      const motionValue = tag.querySelector(
        ".motion-drop-zone .drop-zone-value"
      );
      const motionClearBtn = tag.querySelector(
        ".motion-drop-zone .clear-state-btn"
      );
      motionValue.textContent = currentMotion;
      if (motionClearBtn)
        DOMUtils.toggleDisplay(motionClearBtn, currentMotion !== "--");
      const expValue = tag.querySelector(
        ".expression-drop-zone .drop-zone-value"
      );
      const expClearBtn = tag.querySelector(
        ".expression-drop-zone .clear-state-btn"
      );
      expValue.textContent = currentExpression;
      if (expClearBtn)
        DOMUtils.toggleDisplay(expClearBtn, currentExpression !== "--");
      statusBar.appendChild(tag);
    }

    return statusBar;
  },

  // 渲染动作和表情资源库（根据在场角色动态生成可用列表）
  renderLibraries() {
    const stagedCharacterIds = new Set(this.stagedCharacters.map((c) => c.id));
    const motionItems = new Set(this.tempLibraryItems.motion);
    const expressionItems = new Set(this.tempLibraryItems.expression);
    stagedCharacterIds.forEach((id) => {
      editorService.motionManager
        .getAvailableItemsForCharacter(id)
        .forEach((item) => motionItems.add(item));
      editorService.expressionManager
        .getAvailableItemsForCharacter(id)
        .forEach((item) => expressionItems.add(item));
    });
    if (stagedCharacterIds.size === 0) {
      editorService.motionManager.getAllKnownItems().forEach((item) => motionItems.add(item));
      editorService.expressionManager
        .getAllKnownItems()
        .forEach((item) => expressionItems.add(item));
    }
    this._renderLibrary("motion", Array.from(motionItems).sort());
    this._renderLibrary("expression", Array.from(expressionItems).sort());

    // 渲染完成后初始化拖放
    this.initDragAndDropForLibraries();
  },

  // 渲染单个资源库（动作或表情）
  _renderLibrary(type, items) {
    const container = document.getElementById(`${type}LibraryList`);
    DOMUtils.clearElement(container);

    const itemElements = items.map((item) =>
      DOMUtils.createElement("div", {
        className: "config-list-item draggable-item",
        draggable: true,
      }, [
        DOMUtils.createElement("span", { className: "item-name" }, item),
      ])
    );

    DOMUtils.appendChildren(container, itemElements);
  },

  // 从文本片段创建项目文件（用于导入时）
  _createProjectFileFromSegments(segments) {
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

  // 使用 BaseEditor 的 executeCommand 方法
  _executeCommand(changeFn) {
    baseEditor.executeCommand(changeFn);
  },

  // 删除 layout 动作
  _deleteLayoutAction(actionId) {
    this._executeCommand((currentState) => {
      currentState.actions = currentState.actions.filter(
        (a) => a.id !== actionId
      );
    });
  },

  // 更新 layout 动作的属性（类型、位置、偏移、服装）
  _updateLayoutActionProperty(actionId, targetElement) {
    const value =
      targetElement.type === "number"
        ? parseInt(targetElement.value) || 0
        : targetElement.value;
    const controlClassName = targetElement.className;
    this._executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (!action) return;
      if (controlClassName.includes("layout-type-select")) {
        action.layoutType = value;
      } else if (controlClassName.includes("layout-costume-select")) {
        action.costume = value;
      } else if (controlClassName.includes("layout-position-select-to")) {
        if (!action.position) action.position = {};
        if (!action.position.to) action.position.to = {};
        action.position.to.side = value;
      } else if (controlClassName.includes("layout-offset-input-to")) {
        if (!action.position) action.position = {};
        if (!action.position.to) action.position.to = {};
        action.position.to.offsetX = value;
      } else if (controlClassName.includes("layout-position-select")) {
        if (!action.position) action.position = {};
        if (!action.position.from) action.position.from = {};
        action.position.from.side = value;
        if (action.layoutType !== "move") {
          if (!action.position.to) action.position.to = {};
          action.position.to.side = value;
        }
      } else if (controlClassName.includes("layout-offset-input")) {
        if (!action.position) action.position = {};
        if (!action.position.from) action.position.from = {};
        action.position.from.offsetX = value;
        if (action.layoutType !== "move") {
          if (!action.position.to) action.position.to = {};
          action.position.to.offsetX = value;
        }
      }
    });
  },

  // 添加临时动作或表情项（用户自定义未在配置中的项）
  _addTempItem(type) {
    const isMotion = type === "motion";
    const input = document.getElementById(
      isMotion ? "tempMotionInput" : "tempExpressionInput"
    );
    const manager = isMotion ? editorService.motionManager : editorService.expressionManager;
    const tempList = this.tempLibraryItems[type];
    const trimmedId = input.value.trim();
    if (!trimmedId) {
      ui.showStatus(`${manager.name}ID不能为空！`, "error");
      return;
    }
    const allItems = new Set([...manager.getAllKnownItems(), ...tempList]);
    if (allItems.has(trimmedId)) {
      ui.showStatus(`该${manager.name}ID已存在！`, "error");
      return;
    }
    tempList.push(trimmedId);
    input.value = "";
    this.renderLibraries();
    ui.showStatus(`已添加临时${manager.name}：${trimmedId}`, "success");
  },

  /**
   * 批量打开Live2D浏览器查看器
   * 扫描当前时间轴中的所有服装ID,为每个服装打开Bestdori Live2D浏览器
   * 超过5个服装时需要用户确认,避免打开过多标签页
   */
  _openLive2dViewers() {
    if (!this.projectFileState || !this.projectFileState.actions) {
      ui.showStatus("没有可分析的剧情内容。", "error");
      window.open("https://bestdori.com/tool/live2d", "_blank");
      return;
    }
    const costumeIds = new Set();
    this.projectFileState.actions.forEach((action) => {
      if (action.type === "layout" && action.costume) {
        costumeIds.add(action.costume);
      }
    });
    if (costumeIds.size === 0) {
      ui.showStatus(
        "当前时间线中未找到任何服装配置，将打开 Live2D 浏览器首页。",
        "info"
      );
      window.open("https://bestdori.com/tool/live2d", "_blank");
      return;
    }
    const costumeArray = Array.from(costumeIds);
    if (costumeArray.length > 5) {
      if (
        !confirm(
          `你即将为 ${costumeArray.length} 个不同的服装打开新的浏览器标签页，确定要继续吗？`
        )
      ) {
        return;
      }
    }
    ui.showStatus(
      `正在为 ${costumeArray.length} 个服装打开 Live2D 浏览器...`,
      "success"
    );
    costumeArray.forEach((costumeId) => {
      const url = `https://bestdori.com/tool/live2d/asset/jp/live2d/chara/${costumeId}`;
      window.open(url, "_blank");
    });
  },

  // 关闭编辑器并清理资源
  _closeEditor() {
    EditorHelper.closeEditor({
      modalId: "expressionEditorModal",
      beforeClose: () => {
        // 销毁 Sortable 实例
        this.sortableInstances.forEach(instance => instance?.destroy());
        this.sortableInstances = [];

        // 停止滚动动画
        if (this.scrollAnimationFrame) {
          cancelAnimationFrame(this.scrollAnimationFrame);
          this.scrollAnimationFrame = null;
        }
      },
    });
  },
};
