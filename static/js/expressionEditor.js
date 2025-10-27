// 动作表情编辑器
import { DataUtils } from "./utils/DataUtils.js";
import { DOMUtils } from "./utils/DOMUtils.js";
import { BaseEditor } from "./utils/BaseEditor.js";
import { DragHelper } from "./utils/DragHelper.js";
import { EditorHelper } from "./utils/EditorHelper.js";
import { ui, renderGroupedView } from "./uiUtils.js";
import { historyManager } from "./historyManager.js";
import { editorService } from "./services/EditorService.js";
import { BaseEditorMixin } from "./mixins/BaseEditorMixin.js";
import { EventHandlerMixin } from "./mixins/EventHandlerMixin.js";
import { LayoutPropertyMixin } from "./mixins/LayoutPropertyMixin.js";
import { ScrollAnimationMixin } from "./mixins/ScrollAnimationMixin.js";

// 创建基础编辑器实例
const baseEditor = new BaseEditor({
  renderCallback: () => {
    expressionEditor.renderTimeline();
  },
  groupSize: 50,
});

export const expressionEditor = {
  baseEditor,
  modalId: "expressionEditorModal",
  saveButtonId: "saveExpressionsBtn",
  importButtonId: "importExpressionsBtn",
  exportButtonId: "exportExpressionsBtn",

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
      .getElementById("resetExpressionsBtn")
      ?.addEventListener("click", () => this.reset());
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

    // 初始化通用事件
    this.initCommonEvents();
  },

  handleDragScrolling: (e) => {
    const containers = [
      expressionEditor.domCache.timeline,
      expressionEditor.domCache.motionList,
      expressionEditor.domCache.expressionList,
    ];
    ScrollAnimationMixin.handleDragScrolling.call(expressionEditor, e, containers);
  },

  afterImport() {
    this.stagedCharacters = this._calculateStagedCharacters(this.projectFileState);
    this.renderTimeline();
  },

  _createActionFromSegment(index, text, speakers) {
    return {
      id: `action-id-${Date.now()}-${index}`,
      type: "talk",
      text: text,
      speakers: speakers,
      motions: [],
    };
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
          if (action.type === "talk") action.motions = [];
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
        const expressionSearch = document.getElementById(
          "expressionSearchInput"
        );
        if (motionSearch) motionSearch.value = "";
        if (expressionSearch) expressionSearch.value = "";
        this.renderTimeline();
        this.domCache.modal?.focus();
        const timeline = this.domCache.timeline;

        timeline.onclick = (e) => {
          const card = e.target.closest(".timeline-item");
          if (!card) return;

          // 处理"设置动作/表情"按钮点击
          if (e.target.matches(".setup-expressions-btn")) {
            const actionId = card.dataset.id;
            const action = this.projectFileState.actions.find(
              (a) => a.id === actionId
            );

            const footer = card.querySelector(".timeline-item-footer");

            // 布局动作：直接显示拖放区（调用showExpressionSetupUI会处理）
            if (action && action.type === "layout") {
              this.showExpressionSetupUI(card);
              return;
            }

            // Talk动作：显示/隐藏角色选择器
            const characterSelector = footer?.querySelector(
              ".motion-character-selector"
            );
            if (characterSelector) {
              // 切换角色选择器的显示状态
              const isHidden = characterSelector.style.display === "none";
              characterSelector.style.display = isHidden ? "block" : "none";
            } else {
              // 首次点击，初始化UI并显示选择器
              this.showExpressionSetupUI(card);
              // 立即显示选择器（只对talk动作）
              const newSelector = footer?.querySelector(
                ".motion-character-selector"
              );
              if (newSelector) {
                newSelector.style.display = "block";
              }
            }
            return;
          }

          // 处理角色选择器中的角色点击
          if (e.target.matches(".character-selector-item") ||
              e.target.closest(".character-selector-item")) {
            const characterItem = e.target.closest(".character-selector-item");
            if (characterItem) {
              const characterId = parseInt(characterItem.dataset.characterId);
              const characterName = characterItem.dataset.characterName;
              const actionId = card.dataset.id;
              const action = this.projectFileState.actions.find(
                (a) => a.id === actionId
              );
              if (action) {
                this._addMotionAssignment(action, {
                  id: characterId,
                  name: characterName,
                });
                // 点击后关闭选择器
                const footer = card.querySelector(".timeline-item-footer");
                const characterSelector = footer?.querySelector(
                  ".motion-character-selector"
                );
                if (characterSelector) {
                  characterSelector.style.display = "none";
                }
              }
            }
            return;
          }

          // 处理删除动作/表情分配按钮
          if (e.target.matches(".assignment-remove-btn")) {
            const assignmentItem = e.target.closest(".motion-assignment-item");
            if (assignmentItem) {
              const assignmentIndex = parseInt(
                assignmentItem.dataset.assignmentIndex
              );
              const actionId = card.dataset.id;
              this._removeMotionAssignment(actionId, assignmentIndex);
            }
            return;
          }

          if (e.target.matches(".clear-state-btn")) {
            const dropZone = e.target.closest(".drop-zone");

            // 处理动作/表情分配项的清除按钮
            const assignmentItem = e.target.closest(".motion-assignment-item");
            if (assignmentItem && dropZone) {
              const actionId = assignmentItem.dataset.actionId;
              const assignmentIndex = parseInt(
                assignmentItem.dataset.assignmentIndex
              );
              const type = dropZone.dataset.type;

              // 更新UI
              const valueElement = dropZone.querySelector(".drop-zone-value");
              if (valueElement) {
                valueElement.textContent = "--";
              }
              DOMUtils.toggleDisplay(e.target, false);

              // 更新数据：检查是布局卡片还是对话卡片
              const action = this.projectFileState.actions.find((a) => a.id === actionId);
              const updates = {};
              updates[type] = "";

              if (action && action.type === "layout") {
                // 布局卡片：更新 initialState
                this._updateLayoutInitialState(actionId, updates);
              } else {
                // 对话卡片：更新 motions 数组
                this._updateMotionAssignment(actionId, assignmentIndex, updates);
              }
              return;
            }
            return;
          }

          if (e.target.matches(".layout-remove-btn")) {
            this._deleteLayoutAction(card.dataset.id);
            return;
          }
        };

        timeline.onchange = (e) => {
          // 处理动作/表情分配项的延时输入变化
          const assignmentItem = e.target.closest(".motion-assignment-item");
          if (assignmentItem && e.target.matches(".assignment-delay-input")) {
            const actionId = assignmentItem.dataset.actionId;
            const assignmentIndex = parseInt(
              assignmentItem.dataset.assignmentIndex
            );
            const delayValue = parseFloat(e.target.value) || 0;

            // 检查是布局卡片还是对话卡片
            const action = this.projectFileState.actions.find((a) => a.id === actionId);

            if (action && action.type === "layout") {
              // 布局卡片：更新 action.delay
              this._executeCommand((currentState) => {
                const layoutAction = currentState.actions.find((a) => a.id === actionId);
                if (layoutAction) {
                  layoutAction.delay = delayValue;
                }
              });
            } else {
              // 对话卡片：更新 motions 数组中的 delay
              this._updateMotionAssignment(actionId, assignmentIndex, {
                delay: delayValue,
              });
            }
            return;
          }

          // 处理布局卡片的延时输入变化（旧的 layout-delay-input，向后兼容）
          if (e.target.matches(".layout-delay-input")) {
            const actionId = e.target.dataset.actionId;
            const delayValue = parseFloat(e.target.value) || 0;

            this._executeCommand((currentState) => {
              const action = currentState.actions.find((a) => a.id === actionId);
              if (action) {
                action.delay = delayValue;
              }
            });
            return;
          }

          // 处理布局动作的属性变化
          const card = e.target.closest(".layout-item");
          if (card && e.target.matches("select, input")) {
            this._updateLayoutActionProperty(card.dataset.id, e.target);
          }
        };

        // 使用 DragHelper 创建 onEnd 处理器
        const onEndHandler = DragHelper.createOnEndHandler({
          editor: baseEditor,
          getGroupingEnabled: () =>
            this.domCache.groupCheckbox?.checked || false,
          groupSize: 50,
          executeFn: (globalOldIndex, globalNewIndex) => {
            this._executeCommand((currentState) => {
              const [movedItem] = currentState.actions.splice(
                globalOldIndex,
                1
              );
              currentState.actions.splice(globalNewIndex, 0, movedItem);
            });
          },
        });

        // 清理旧的 Sortable 实例
        this.sortableInstances.forEach((instance) => instance?.destroy());
        this.sortableInstances = [];

        this.sortableInstances.push(
          new Sortable(
            timeline,
            DragHelper.createSortableConfig({
              group: "timeline-cards",
              onEnd: (evt) => {
                document.removeEventListener(
                  "dragover",
                  this.handleDragScrolling
                );
                this.stopScrolling();
                onEndHandler(evt);
              },
              extraConfig: {
                sort: true,
                onStart: () => {
                  document.addEventListener(
                    "dragover",
                    this.handleDragScrolling
                  );
                },
              },
            })
          )
        );

        // 渲染资源库并初始化拖放（必须在渲染后初始化）
        this.renderLibraries();
      },
    });
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

    DOMUtils.clearElement(footer);

    // 布局动作使用与对话卡片相同的分配系统
    if (action.type === "layout") {
      // 初始化initialState
      if (!action.initialState) {
        action.initialState = {};
      }

      // 创建动作分配容器
      const assignmentsContainer = DOMUtils.createElement("div", {
        className: "motion-assignments-container",
      });
      assignmentsContainer.dataset.actionId = action.id;

      // 为布局卡片创建一个分配项（只有一个角色）
      const char = {
        id: action.characterId,
        name: action.characterName || editorService.getCharacterNameById(action.characterId),
      };

      if (char.name) {
        // 将 initialState 转换为 motionData 格式
        const motionData = {
          character: char.id,
          motion: action.initialState.motion || "",
          expression: action.initialState.expression || "",
          delay: action.delay || 0,
        };

        const assignmentItem = this._createAssignmentItem(action, motionData, 0, true);
        assignmentsContainer.appendChild(assignmentItem);
      }

      footer.appendChild(assignmentsContainer);
      return;
    }

    // Talk动作使用新的分配系统
    // 创建动作分配容器（用于显示已添加的分配）
    const assignmentsContainer = DOMUtils.createElement("div", {
      className: "motion-assignments-container",
    });
    assignmentsContainer.dataset.actionId = actionId;

    // 渲染已有的动作/表情分配
    if (action.motions && action.motions.length > 0) {
      action.motions.forEach((motionData, index) => {
        const assignmentItem = this._createAssignmentItem(
          action,
          motionData,
          index
        );
        assignmentsContainer.appendChild(assignmentItem);
      });
    }

    // 创建角色选择器
    const characterSelector = this._createCharacterSelector(action);

    // 创建"设置动作/表情"按钮（始终显示）
    const setupButton = DOMUtils.createButton(
      "设置动作/表情",
      "btn btn-secondary btn-sm setup-expressions-btn"
    );
    // 事件处理通过timeline的事件委托完成，不需要在这里绑定

    // 添加到footer
    footer.appendChild(assignmentsContainer);
    footer.appendChild(characterSelector);
    footer.appendChild(setupButton);

    // 默认隐藏角色选择器
    characterSelector.style.display = "none";
  },

  // 创建角色选择器UI
  _createCharacterSelector(action) {
    const template = document.getElementById(
      "motion-character-selector-template"
    );
    const selectorFragment = template.content.cloneNode(true);

    // 将DocumentFragment转换为实际的DOM元素
    const selectorContainer = DOMUtils.createElement("div");
    selectorContainer.appendChild(selectorFragment);
    const selector = selectorContainer.firstElementChild;

    const listContainer = selector.querySelector(".character-selector-list");

    // 根据action类型确定可选择的角色
    let availableCharacters = [];
    if (action.type === "talk") {
      // talk动作：显示所有登场的角色
      availableCharacters = this.stagedCharacters;
    } else if (action.type === "layout") {
      // layout动作：只显示该布局涉及的角色
      const char = {
        id: action.characterId,
        name:
          action.characterName ||
          editorService.getCharacterNameById(action.characterId),
      };
      if (char.name) {
        availableCharacters = [char];
      }
    }

    // 创建角色选项
    availableCharacters.forEach((char) => {
      const optionTemplate = document.getElementById(
        "motion-character-option-template"
      );
      const option = optionTemplate.content.cloneNode(true);
      const optionElement = option.querySelector(".character-selector-item");

      optionElement.dataset.characterId = char.id;
      optionElement.dataset.characterName = char.name;

      const avatarDiv = option.querySelector(".dialogue-avatar");
      editorService.updateCharacterAvatar(
        { querySelector: () => avatarDiv },
        char.id,
        char.name
      );

      option.querySelector(".character-name").textContent = char.name;

      // 事件处理通过timeline的事件委托完成，不需要在这里绑定

      listContainer.appendChild(option);
    });

    return selector;
  },

  // 添加新的动作/表情分配
  _addMotionAssignment(action, character) {
    let newIndex = -1;

    this._executeCommand((currentState) => {
      const currentAction = currentState.actions.find(
        (a) => a.id === action.id
      );
      if (!currentAction) return;

      // 确保motions数组存在
      if (!currentAction.motions) {
        currentAction.motions = [];
      }

      // 添加新的分配
      currentAction.motions.push({
        character: character.id,
        motion: "",
        expression: "",
        delay: 0,
      });

      newIndex = currentAction.motions.length - 1;
    });

    // 增量渲染：只添加新的分配项，而不是重新渲染整个footer
    const cardElement = document.querySelector(
      `.timeline-item[data-id="${action.id}"]`
    );
    if (cardElement && newIndex >= 0) {
      const footer = cardElement.querySelector(".timeline-item-footer");
      const assignmentsContainer = footer?.querySelector(
        ".motion-assignments-container"
      );

      if (assignmentsContainer) {
        // 获取更新后的action数据
        const updatedAction = this.projectFileState.actions.find(
          (a) => a.id === action.id
        );
        if (updatedAction && updatedAction.motions) {
          const newMotionData = updatedAction.motions[newIndex];
          const assignmentItem = this._createAssignmentItem(
            updatedAction,
            newMotionData,
            newIndex
          );
          assignmentsContainer.appendChild(assignmentItem);
        }
      }
    }
  },

  // 创建单个动作/表情分配项UI
  _createAssignmentItem(action, motionData, index, isLayoutCard = false) {
    const template = document.getElementById("motion-assignment-item-template");
    const itemFragment = template.content.cloneNode(true);

    // 将DocumentFragment转换为实际的DOM元素
    const itemContainer = DOMUtils.createElement("div");
    itemContainer.appendChild(itemFragment);
    const itemElement = itemContainer.firstElementChild;

    // 获取角色信息
    const character = this.stagedCharacters.find(
      (c) => c.id === motionData.character
    );
    const characterName =
      character?.name || editorService.getCharacterNameById(motionData.character);

    itemElement.dataset.characterId = motionData.character;
    itemElement.dataset.characterName = characterName;
    itemElement.dataset.assignmentIndex = index;
    itemElement.dataset.actionId = action.id;

    // 如果是布局卡片，隐藏删除按钮
    if (isLayoutCard) {
      const removeBtn = itemElement.querySelector(".assignment-remove-btn");
      if (removeBtn) {
        DOMUtils.toggleDisplay(removeBtn, false);
      }
    }

    // 设置角色头像和名称
    const avatarDiv = itemElement.querySelector(".dialogue-avatar");
    editorService.updateCharacterAvatar(
      { querySelector: () => avatarDiv },
      motionData.character,
      characterName
    );
    itemElement.querySelector(".character-name").textContent = characterName;

    // 设置拖放区的值
    const motionValue = itemElement.querySelector(
      ".motion-drop-zone .drop-zone-value"
    );
    const motionClearBtn = itemElement.querySelector(
      ".motion-drop-zone .clear-state-btn"
    );
    motionValue.textContent = motionData.motion || "--";
    if (motionClearBtn) {
      DOMUtils.toggleDisplay(motionClearBtn, !!motionData.motion);
    }

    const expressionValue = itemElement.querySelector(
      ".expression-drop-zone .drop-zone-value"
    );
    const expressionClearBtn = itemElement.querySelector(
      ".expression-drop-zone .clear-state-btn"
    );
    expressionValue.textContent = motionData.expression || "--";
    if (expressionClearBtn) {
      DOMUtils.toggleDisplay(expressionClearBtn, !!motionData.expression);
    }

    // 设置延时值
    const delayInput = itemElement.querySelector(".assignment-delay-input");
    delayInput.value = motionData.delay || 0;

    // 初始化拖放区
    this._initSortableForAssignmentZones(itemElement, isLayoutCard);

    // 事件处理通过timeline的事件委托完成，不需要在这里绑定

    return itemElement;
  },

  // 为动作/表情分配项的拖放区初始化 Sortable
  _initSortableForAssignmentZones(assignmentElement, isLayoutCard = false) {
    assignmentElement.querySelectorAll(".drop-zone").forEach((zone) => {
      new Sortable(zone, {
        group: {
          name: zone.dataset.type,
          put: function (_to, _from, dragEl) {
            return dragEl.classList.contains("draggable-item");
          },
        },
        animation: 150,

        onAdd: (evt) => {
          const value = evt.item ? evt.item.textContent.trim() : null;
          const dropZone = evt.to;
          const assignmentItem = dropZone.closest(".motion-assignment-item");

          // 立即移除拖拽的元素
          evt.item.remove();

          if (value && assignmentItem) {
            const actionId = assignmentItem.dataset.actionId;
            const assignmentIndex = parseInt(
              assignmentItem.dataset.assignmentIndex
            );
            const type = dropZone.dataset.type;

            // 先立即更新UI显示
            const valueElement = dropZone.querySelector(".drop-zone-value");
            if (valueElement) {
              valueElement.textContent = value;
            }

            const clearBtn = dropZone.querySelector(".clear-state-btn");
            if (clearBtn) {
              DOMUtils.toggleDisplay(clearBtn, true);
            }

            // 然后更新数据
            const updates = {};
            updates[type] = value;

            if (isLayoutCard) {
              // 布局卡片：更新 initialState
              this._updateLayoutInitialState(actionId, updates);
            } else {
              // 对话卡片：更新 motions 数组
              this._updateMotionAssignment(actionId, assignmentIndex, updates);
            }
          }
        },
      });
    });
  },

  // 更新布局卡片的 initialState
  _updateLayoutInitialState(actionId, updates) {
    this._executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (!action || action.type !== "layout") return;

      if (!action.initialState) {
        action.initialState = {};
      }

      Object.assign(action.initialState, updates);
    });
  },

  // 更新动作/表情分配
  _updateMotionAssignment(actionId, assignmentIndex, updates) {
    this._executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (!action || !action.motions || !action.motions[assignmentIndex]) return;

      Object.assign(action.motions[assignmentIndex], updates);
    });
  },

  // 删除动作/表情分配
  _removeMotionAssignment(actionId, assignmentIndex) {
    this._executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (!action || !action.motions) return;

      action.motions.splice(assignmentIndex, 1);
    });

    // 增量更新：重新渲染所有分配项以更新索引
    // （因为删除会影响后续项的索引，所以需要全部重新渲染）
    const cardElement = document.querySelector(
      `.timeline-item[data-id="${actionId}"]`
    );
    if (cardElement) {
      const footer = cardElement.querySelector(".timeline-item-footer");
      const assignmentsContainer = footer?.querySelector(
        ".motion-assignments-container"
      );

      if (assignmentsContainer) {
        DOMUtils.clearElement(assignmentsContainer);

        // 获取更新后的action数据
        const updatedAction = this.projectFileState.actions.find(
          (a) => a.id === actionId
        );
        if (updatedAction && updatedAction.motions) {
          updatedAction.motions.forEach((motionData, index) => {
            const assignmentItem = this._createAssignmentItem(
              updatedAction,
              motionData,
              index
            );
            assignmentsContainer.appendChild(assignmentItem);
          });
        }
      }
    }
  },

  // 检查动作是否包含表情数据（motions 数组或 initialState）
  _actionHasExpressionData(action) {
    if (action.type === "talk") {
      return action.motions && action.motions.length > 0;
    }

    if (action.type === "layout") {
      return action.initialState && Object.keys(action.initialState).length > 0;
    }
    return false;
  },


  // 初始化动作和表情资源库的拖放功能
  initDragAndDropForLibraries() {
    // 先销毁资源库相关的 Sortable 实例（只保留 timeline 的实例）
    const timelineSortable = this.sortableInstances[0]; // timeline 的实例是第一个
    this.sortableInstances.slice(1).forEach((instance) => instance?.destroy());
    this.sortableInstances = timelineSortable ? [timelineSortable] : [];

    ["motion", "expression"].forEach((type) => {
      const libraryList =
        type === "motion"
          ? this.domCache.motionList
          : this.domCache.expressionList;

      if (libraryList) {
        this.sortableInstances.push(
          new Sortable(libraryList, {
            group: { name: type, pull: "clone", put: false },
            sort: false,
            onStart: () => {
              document.addEventListener("dragover", this.handleDragScrolling);
            },
            onEnd: () => {
              document.removeEventListener(
                "dragover",
                this.handleDragScrolling
              );
              this.stopScrolling();
            },
          })
        );
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

        // 主位置显示逻辑：与 live2dEditor 保持一致
        // - 展开时：所有类型都显示起点（from）
        // - 未展开时：移动显示终点（to），登场/退场显示起点（from）
        const isExpanded = action._independentToPosition;
        const isMove = action.layoutType === "move";
        const currentPosition = (isExpanded || !isMove)
          ? (action.position?.from?.side || "center")
          : (action.position?.to?.side || "center");
        const currentOffset = (isExpanded || !isMove)
          ? (action.position?.from?.offsetX || 0)
          : (action.position?.to?.offsetX || 0);
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
        const toggleBtn = card.querySelector(".toggle-position-btn");
        const mainPositionLabel = card.querySelector(".main-position-label");
        const mainOffsetLabel = card.querySelector(".main-offset-label");

        // 根据 _independentToPosition 标记决定是否显示第二个位置行
        // 与 live2dEditor 保持一致
        if (action._independentToPosition) {
          // 展开模式：修改标签为"起点"，显示终点配置
          toPositionContainer.style.display = "grid";
          if (mainPositionLabel) mainPositionLabel.textContent = "起点:";
          if (mainOffsetLabel) mainOffsetLabel.textContent = "偏移:";

          // 填充终点的值
          const toSide = action.position?.to?.side || "center";
          const toOffsetX = action.position?.to?.offsetX || 0;
          card.querySelector(".layout-position-select-to").value = toSide;
          card.querySelector(".layout-offset-input-to").value = toOffsetX;
        } else {
          // 收起模式：标签显示"位置"，隐藏终点配置
          toPositionContainer.style.display = "none";
          if (mainPositionLabel) mainPositionLabel.textContent = "位置:";
          if (mainOffsetLabel) mainOffsetLabel.textContent = "偏移:";
        }

        // 隐藏切换按钮（此功能仅在 live2d 编辑器中使用）
        if (toggleBtn) {
          toggleBtn.classList.add("hidden");
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
        // 对于talk动作，使用新的分配系统渲染
        if (action.type === "talk") {
          // 创建动作分配容器
          const assignmentsContainer = DOMUtils.createElement("div", {
            className: "motion-assignments-container",
          });
          assignmentsContainer.dataset.actionId = action.id;

          // 渲染已有的动作/表情分配
          if (action.motions && action.motions.length > 0) {
            action.motions.forEach((motionData, index) => {
              const assignmentItem = this._createAssignmentItem(
                action,
                motionData,
                index
              );
              assignmentsContainer.appendChild(assignmentItem);
            });
          }

          // 创建角色选择器
          const characterSelector = this._createCharacterSelector(action);
          characterSelector.style.display = "none"; // 默认隐藏

          // 创建"设置动作/表情"按钮
          const setupButton = DOMUtils.createButton(
            "设置动作/表情",
            "btn btn-secondary btn-sm setup-expressions-btn"
          );

          DOMUtils.clearElement(footer);
          footer.appendChild(assignmentsContainer);
          footer.appendChild(characterSelector);
          footer.appendChild(setupButton);
        } else if (action.type === "layout") {
          // layout动作使用与talk相同的分配系统
          const assignmentsContainer = DOMUtils.createElement("div", {
            className: "motion-assignments-container",
          });
          assignmentsContainer.dataset.actionId = action.id;

          // 为布局卡片创建一个分配项（只有一个角色）
          const char = {
            id: action.characterId,
            name: action.characterName || editorService.getCharacterNameById(action.characterId),
          };

          if (char.name) {
            // 将 initialState 转换为 motionData 格式
            const motionData = {
              character: char.id,
              motion: action.initialState?.motion || "",
              expression: action.initialState?.expression || "",
              delay: action.delay || 0,
            };

            const assignmentItem = this._createAssignmentItem(action, motionData, 0, true);
            assignmentsContainer.appendChild(assignmentItem);
          }

          DOMUtils.clearElement(footer);
          footer.appendChild(assignmentsContainer);
        }
      } else {
        // 没有表情数据时显示"设置动作/表情"按钮
        // 但layout动作点击后会直接显示拖放区而不是按钮
        DOMUtils.clearElement(footer);
        if (action.type === "talk") {
          const setupButton = DOMUtils.createButton(
            "设置动作/表情",
            "btn btn-secondary btn-sm setup-expressions-btn"
          );
          footer.appendChild(setupButton);
        } else if (action.type === "layout") {
          const setupButton = DOMUtils.createButton(
            "设置动作/表情",
            "btn btn-secondary btn-sm setup-expressions-btn"
          );
          footer.appendChild(setupButton);
        }
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
      editorService.motionManager
        .getAllKnownItems()
        .forEach((item) => motionItems.add(item));
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
      DOMUtils.createElement(
        "div",
        {
          className: "config-list-item draggable-item",
          draggable: true,
        },
        [DOMUtils.createElement("span", { className: "item-name" }, item)]
      )
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

        return this._createActionFromSegment(index, cleanText, speakers);
      }),
    };
    return newProjectFile;
  },

  // 使用 BaseEditor 的 executeCommand 方法
  _executeCommand(changeFn) {
    baseEditor.executeCommand(changeFn);
  },

  // 添加临时动作或表情项（用户自定义未在配置中的项）
  _addTempItem(type) {
    const isMotion = type === "motion";
    const input = document.getElementById(
      isMotion ? "tempMotionInput" : "tempExpressionInput"
    );
    const manager = isMotion
      ? editorService.motionManager
      : editorService.expressionManager;
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
};

// 应用 mixins
Object.assign(expressionEditor, BaseEditorMixin, EventHandlerMixin, LayoutPropertyMixin, ScrollAnimationMixin);
