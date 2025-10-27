// live2d布局编辑器
import { DataUtils } from "./utils/DataUtils.js";
import { DOMUtils } from "./utils/DOMUtils.js";
import { BaseEditor } from "./utils/BaseEditor.js";
import { DragHelper } from "./utils/DragHelper.js";
import { EditorHelper } from "./utils/EditorHelper.js";
import { ui, renderGroupedView } from "./uiUtils.js";
import { historyManager } from "./historyManager.js";
import { editorService } from "./services/EditorService.js";
import { storageService, STORAGE_KEYS } from "./services/StorageService.js";
import { BaseEditorMixin } from "./mixins/BaseEditorMixin.js";
import { EventHandlerMixin } from "./mixins/EventHandlerMixin.js";
import { LayoutPropertyMixin } from "./mixins/LayoutPropertyMixin.js";
import { ScrollAnimationMixin } from "./mixins/ScrollAnimationMixin.js";
import { CharacterListMixin } from "./mixins/CharacterListMixin.js";

// 创建基础编辑器实例
const baseEditor = new BaseEditor({
  renderCallback: () => {
    live2dEditor.renderTimeline();
    const usedNames = live2dEditor._getUsedCharacterIds();
    live2dEditor.renderCharacterList(usedNames);
  },
  groupSize: 50,
});

export const live2dEditor = {
  baseEditor,
  modalId: "live2dEditorModal",
  saveButtonId: "saveLayoutsBtn",
  importButtonId: "importLayoutsBtn",
  exportButtonId: "exportLayoutsBtn",
  characterListId: "live2dEditorCharacterList",

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
  // 后续布局模式: 'move' 或 'hide'
  subsequentLayoutMode: "move",

  // 初始化编辑器，绑定事件监听器和快捷键
  init() {
    // 缓存 DOM 元素
    this.domCache = {
      groupCheckbox: document.getElementById("groupCardsCheckbox"),
      timeline: document.getElementById("live2dEditorTimeline"),
      characterList: document.getElementById("live2dEditorCharacterList"),
      modal: document.getElementById("live2dEditorModal"),
      undoBtn: document.getElementById("live2dUndoBtn"),
      redoBtn: document.getElementById("live2dRedoBtn"),
      toggleSubsequentModeBtn: document.getElementById(
        "toggleSubsequentLayoutModeBtn"
      ),
      subsequentModeText: document.getElementById("subsequentLayoutModeText"),
    };

    const savedMode = storageService.get(STORAGE_KEYS.LIVE2D_SUBSEQUENT_MODE);
    if (savedMode === "hide" || savedMode === "move") {
      this.subsequentLayoutMode = savedMode;
    }

    document
      .getElementById("openLive2dEditorBtn")
      ?.addEventListener("click", () => this.open());
    document
      .getElementById("autoLayoutBtn")
      ?.addEventListener("click", () => this._applyAutoLayout());
    document
      .getElementById("resetLayoutsBtn")
      ?.addEventListener("click", () => this._clearAllLayouts());
    this.domCache.toggleSubsequentModeBtn?.addEventListener("click", () =>
      this._toggleSubsequentLayoutMode()
    );

    // 初始化通用事件
    this.initCommonEvents();

    // 初始化置顶按钮处理
    this.initPinButtonHandler();
  },

  // 打开 Live2D 布局编辑器模态框
  async open() {
    await EditorHelper.openEditor({
      editor: baseEditor,
      modalId: "live2dEditorModal",
      buttonId: "openLive2dEditorBtn",
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
            if (rawText.trim()) {
              ui.showStatus("已根据当前文本创建新项目。", "info");
            }
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
        this.renderTimeline();
        const usedCharacterNames = this._getUsedCharacterIds();
        this.renderCharacterList(usedCharacterNames);
        this.initDragAndDrop();
        this._updateSubsequentModeButton();

        if (this.domCache.modal) this.domCache.modal.focus();
        const timeline = this.domCache.timeline;
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
      },
    });
  },

  // 从文本片段创建项目文件（解析说话人并创建对话动作）
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

        return this._createActionFromSegment(index, cleanText, speakers);
      }),
    };
    return newProjectFile;
  },

  // 获取所有已使用的角色名称集合（在布局中出现的角色）
  _getUsedCharacterIds() {
    const usedNames = new Set();
    if (this.projectFileState && this.projectFileState.actions) {
      this.projectFileState.actions.forEach((action) => {
        if (action.type === "layout" && action.characterName) {
          usedNames.add(action.characterName);
        }
      });
    }
    return usedNames;
  },

  async _clearAllLayouts() {
    if (!confirm("确定要清空所有布局吗？此操作可以撤销。")) {
      return;
    }

    const resetBtn = document.getElementById("resetLayoutsBtn");
    const originalText = resetBtn?.textContent;
    if (resetBtn) resetBtn.textContent = "清空中...";

    try {
      this._executeCommand((currentState) => {
        currentState.actions = currentState.actions.filter(
          (a) => a.type !== "layout"
        );
      });
      ui.showStatus("已清空所有布局。", "success");
    } finally {
      if (resetBtn && originalText) resetBtn.textContent = originalText;
    }
  },

  handleDragScrolling: (e) => {
    const containers = [
      live2dEditor.domCache.timeline,
      live2dEditor.domCache.characterList,
    ];
    ScrollAnimationMixin.handleDragScrolling.call(live2dEditor, e, containers);
  },

  // 初始化拖放功能（角色列表拖入时间轴创建布局动作）
  initDragAndDrop() {
    const characterList = this.domCache.characterList;
    const timeline = this.domCache.timeline;
    if (!characterList || !timeline) return;

    // 清理旧的 Sortable 实例
    this.sortableInstances.forEach((instance) => instance?.destroy());
    this.sortableInstances = [];

    // 角色列表的 Sortable 配置（只允许拖出，不允许排序）
    this.sortableInstances.push(
      new Sortable(characterList, {
        group: {
          name: "live2d-shared",
          pull: "clone",
          put: false,
        },
        sort: false,
        onStart: () =>
          document.addEventListener("dragover", this.handleDragScrolling),
        onEnd: () => {
          document.removeEventListener("dragover", this.handleDragScrolling);
          this.stopScrolling();
        },
      })
    );

    // 使用 DragHelper 创建 onEnd 处理器（移动现有卡片）
    const onEndHandler = DragHelper.createOnEndHandler({
      editor: baseEditor,
      getGroupingEnabled: () => this.domCache.groupCheckbox?.checked || false,
      groupSize: 50,
      executeFn: (globalOldIndex, globalNewIndex) => {
        this._executeCommand((currentState) => {
          // 验证索引有效性
          if (globalOldIndex < 0 || globalOldIndex >= currentState.actions.length) {
            console.error(`Invalid globalOldIndex: ${globalOldIndex}, actions length: ${currentState.actions.length}`);
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

    // 使用 DragHelper 创建 onAdd 处理器（添加新卡片）
    const onAddHandler = DragHelper.createOnAddHandler({
      editor: baseEditor,
      getGroupingEnabled: () => this.domCache.groupCheckbox?.checked || false,
      groupSize: 50,
      validateItem: (item) => item.classList.contains("character-item"),
      extractData: (item) => ({
        characterId: parseInt(item.dataset.characterId),
        characterName: item.dataset.characterName,
      }),
      executeFn: (data, globalInsertIndex) => {
        if (data.characterId && data.characterName) {
          this.insertLayoutAction(
            data.characterId,
            data.characterName,
            globalInsertIndex
          );
        }
      },
    });

    // 时间轴的 Sortable 配置
    this.sortableInstances.push(
      new Sortable(
        timeline,
        DragHelper.createSortableConfig({
          group: "live2d-shared",
          onEnd: (evt) => {
            document.removeEventListener("dragover", this.handleDragScrolling);
            this.stopScrolling();
            onEndHandler(evt);
          },
          onAdd: onAddHandler,
          extraConfig: {
            sort: true,
            filter: ".timeline-group-header",
            onStart: () =>
              document.addEventListener("dragover", this.handleDragScrolling),
          },
        })
      )
    );
  },

  /**
   * 切换后续布局模式（移动/退场）
   */
  _toggleSubsequentLayoutMode() {
    this.subsequentLayoutMode =
      this.subsequentLayoutMode === "move" ? "hide" : "move";
    storageService.set(
      STORAGE_KEYS.LIVE2D_SUBSEQUENT_MODE,
      this.subsequentLayoutMode
    );
    this._updateSubsequentModeButton();
  },

  /**
   * 更新后续布局模式按钮的文本
   */
  _updateSubsequentModeButton() {
    if (this.domCache.subsequentModeText) {
      const modeText = this.subsequentLayoutMode === "move" ? "移动" : "退场";
      this.domCache.subsequentModeText.textContent = `后续: ${modeText}`;
    }
  },

  /**
   * 快速布局
   * 1. 清空所有现有布局动作
   * 2. 遍历对话动作,找到每个角色的首次发言
   * 3. 在首次发言前插入登场动作(appear)
   * 4. 根据配置自动设置位置和服装
   */
  _applyAutoLayout() {
    if (
      !confirm(
        "这将清空所有现有的Live2D布局，并根据角色的首次发言自动生成新的登场布局。确定要继续吗？"
      )
    ) {
      return;
    }
    this._executeCommand((currentState) => {
      // 清空现有布局
      currentState.actions = currentState.actions.filter(
        (a) => a.type !== "layout"
      );
      const appearedCharacterNames = new Set();
      const newActions = [];

      // 遍历对话,为首次发言的角色创建登场动作
      currentState.actions.forEach((action) => {
        if (action.type === "talk" && action.speakers.length > 0) {
          action.speakers.forEach((speaker) => {
            if (!appearedCharacterNames.has(speaker.name)) {
              appearedCharacterNames.add(speaker.name);
              const defaultCostume = this._getDefaultCostume(speaker.name);
              const positionConfig =
                editorService.positionManager.getCharacterPositionConfig(
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

  /**
   * 插入布局动作(拖拽角色到时间轴时调用)
   * 根据角色的历史状态智能判断动作类型:
   * - 角色未登场 -> appear(登场)
   * - 角色已登场 -> 根据 subsequentLayoutMode 设置为 move(移动) 或 hide(退场)
   * 自动继承上一次的服装和位置
   */
  insertLayoutAction(characterId, characterName, index) {
    this._executeCommand((currentState) => {
      const previousState = this._getCharacterStateAtIndex(
        currentState.actions,
        characterName,
        index
      );
      const layoutType = previousState.onStage
        ? this.subsequentLayoutMode
        : "appear";
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

  // 使用 BaseEditor 的 executeCommand 方法
  _executeCommand(changeFn) {
    baseEditor.executeCommand(changeFn, { skipIfNoChange: true });
  },

  // 获取角色的默认服装ID
  _getDefaultCostume(characterName) {
    return editorService.state.get("currentCostumes")[characterName] || "";
  },

  // 获取角色的默认位置配置（自动模式或手动模式）
  _getDefaultPosition(characterName) {
    const pm = editorService.positionManager;
    if (!pm.autoPositionMode && pm.manualPositions[characterName]) {
      return {
        position: pm.manualPositions[characterName].position || "center",
        offset: pm.manualPositions[characterName].offset || 0,
      };
    }
    return { position: "center", offset: 0 };
  },

  /**
   * 渲染Live2D布局编辑器时间轴
   * 渲染两种类型的卡片:
   * - talk卡片: 显示对话内容和说话人信息(只读)
   * - layout卡片: 可编辑的布局动作,包含类型/位置/服装/偏移量选择器
   * 支持分组模式(50条/组)优化长剧本性能,自动显示卡片序号和布局类型样式
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
        card.querySelector(".timeline-item").dataset.id = action.id;
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
        // 应用布局类型 CSS 类名
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
          DOMUtils.toggleDisplay(toPositionContainer, true);
          toPositionContainer.style.display = "grid"; // 保持 grid 布局
          card.querySelector(".layout-position-select-to").value =
            action.position?.to?.side || "center";
          card.querySelector(".layout-offset-input-to").value =
            action.position?.to?.offsetX || 0;
        } else {
          DOMUtils.toggleDisplay(toPositionContainer, false);
        }
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
   * 获取角色在指定索引位置的状态
   * 通过回溯历史布局动作,追踪角色的登场状态、位置和服装
   * @param {Array} actions - 动作数组
   * @param {string} characterName - 角色名
   * @param {number} startIndex - 检查的起始索引
   * @returns {Object} { onStage: 是否在场, lastPosition: 最后位置, lastCostume: 最后服装 }
   */
  _getCharacterStateAtIndex(actions, characterName, startIndex) {
    let onStage = false;
    let lastPosition = null;
    let lastCostume = null;

    // 从头遍历到指定索引,追踪角色状态变化
    for (let i = 0; i < startIndex; i++) {
      const action = actions[i];
      if (
        action &&
        action.type === "layout" &&
        action.characterName === characterName
      ) {
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

  // 钩子方法：导入后刷新视图
  afterImport() {
    this.renderTimeline();
    const usedCharacterNames = this._getUsedCharacterIds();
    this.renderCharacterList(usedCharacterNames);
  },

  // 钩子方法：置顶切换后刷新角色列表
  afterPinToggle() {
    const usedCharacterNames = this._getUsedCharacterIds();
    this.renderCharacterList(usedCharacterNames);
  },

  // 从文本片段创建动作对象
  _createActionFromSegment(index, text, speakers) {
    return {
      id: `action-id-${Date.now()}-${index}`,
      type: "talk",
      text: text,
      speakers: speakers,
    };
  },
};

// 继承 mixins
Object.assign(live2dEditor, BaseEditorMixin, EventHandlerMixin, LayoutPropertyMixin, ScrollAnimationMixin, CharacterListMixin);
