// 动作表情编辑器里的交互
import { DOMUtils } from "@utils/DOMUtils.js";
import { ui } from "@utils/uiUtils.js";
import { configManager } from "@managers/configManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { modalService } from "@services/ModalService.js";
import { state } from "@managers/stateManager.js";
import {
  motionManager,
  expressionManager,
} from "@managers/motionExpressionManager.js";
import { assignmentRenderer } from "@editors/expression/expressionAssignmentRenderer.js";
import { shortValue } from "@editors/common/changeSummaryUtils.js";
import { DragHelper } from "@editors/common/DragHelper.js";

// 库的类型
const LIBRARY_TYPES = ["motion", "expression"];
// 每种库对应的配置
const LIBRARY_CONFIG = {
  motion: {
    manager: motionManager,
    domKey: "motionList",
    listId: "motionLibraryList",
    inputId: "tempMotionInput",
    searchInputId: "motionSearchInput",
    dropdownId: "motionQuickFill",
  },
  expression: {
    manager: expressionManager,
    domKey: "expressionList",
    listId: "expressionLibraryList",
    inputId: "tempExpressionInput",
    searchInputId: "expressionSearchInput",
    dropdownId: "expressionQuickFill",
  },
};
const LIVE2D_VIEWER_HOME_URL = "https://bestdori.com/tool/live2d";

// 把一条分配内容压成短文字
function summarizeAssignmentItem(item) {
  if (!item) {
    return "none";
  }
  return `character=${item.character}, motion=${shortValue(
    item.motion
  )}, expression=${shortValue(item.expression)}, delay=${shortValue(item.delay)}`;
}

// 按 id 找动作
function findAction(actions, actionId) {
  return actions.find((actionItem) => actionItem.id === actionId);
}

// 修改一条动作
function executeActionMutation(editor, actionId, mutate) {
  editor.executeCommand((currentState) => {
    const action = findAction(currentState.actions, actionId);
    if (action) {
      mutate(action, currentState);
    }
  });
}

// 把更新内容整理成短文字
function summarizeUpdates(beforeValue, updates) {
  return Object.keys(updates)
    .map(
      (key) =>
        `${key}: ${shortValue(beforeValue?.[key])} -> ${shortValue(updates[key])}`
    )
    .join(", ");
}

// 记录局部刷新再执行修改
function markExpressionMutation(editor, actionId, operation, detail, mutate) {
  editor.markExpressionCardRender(actionId, { operation, detail });
  executeActionMutation(editor, actionId, mutate);
}

// 读取一条分配项的上下文
function resolveAssignmentContext(target) {
  const assignmentItem = target.closest(".motion-assignment-item");
  if (!assignmentItem) {
    return null;
  }
  return {
    actionId: assignmentItem.dataset.actionId,
    assignmentIndex: Number.parseInt(assignmentItem.dataset.assignmentIndex, 10),
  };
}

// 刷新拖放区域里的显示值
function updateDropZoneValue(dropZone, value, showClearButton) {
  dropZone.querySelector(".drop-zone-value").textContent = value;
  DOMUtils.toggleDisplay(dropZone.querySelector(".clear-state-btn"), showClearButton);
}

export function attachExpressionBehavior(editor) {
  Object.assign(editor, {
    // 看这条动作有没有动作表情数据
    actionHasExpressionData(action) {
      if (action.type === "talk") {
        return action.motions && action.motions.length > 0;
      }
      if (action.type === "layout") {
        const hasInitialState =
          action.initialState && Object.keys(action.initialState).length > 0;
        const hasDelay = typeof action.delay === "number";
        return hasInitialState || hasDelay;
      }
      return false;
    },

    // 读取已经登场的角色
    collectStagedCharacters() {
      const appearedCharacterNames = new Set();
      const characters = [];

      if (this.projectFileState?.actions) {
        this.projectFileState.actions.forEach((action) => {
          if (action.type !== "layout" || action.layoutType !== "appear") {
            return;
          }
          const characterName =
            action.characterName || configManager.findCharacterNameById(action.characterId);
          if (characterName && !appearedCharacterNames.has(characterName)) {
            appearedCharacterNames.add(characterName);
            characters.push({
              id: action.characterId,
              name: characterName,
            });
          }
        });
      }

      return characters;
    },

    // 给对话加一条动作分配
    addMotionAssignment(actionId, character) {
      markExpressionMutation(
        this,
        actionId,
        "talk:add-character",
        `character=${character.name}(ID:${character.id})`,
        (action) => {
        if (!action.motions) {
          action.motions = [];
        }
        action.motions.push({
          character: character.id,
          motion: "",
          expression: "",
          delay: 0,
        });
      });
    },

    // 更新布局的初始动作表情
    updateLayoutInitialState(actionId, updates) {
      const action = findAction(this.projectFileState.actions, actionId);
      markExpressionMutation(
        this,
        actionId,
        "layout:update-initial-state",
        summarizeUpdates(action?.initialState, updates),
        (actionToUpdate) => {
        if (actionToUpdate.type !== "layout") {
          return;
        }
        if (!actionToUpdate.initialState) {
          actionToUpdate.initialState = {};
        }
        Object.assign(actionToUpdate.initialState, updates);
      });
    },

    // 更新一条动作分配
    updateMotionAssignment(actionId, assignmentIndex, updates) {
      const action = findAction(this.projectFileState.actions, actionId);
      markExpressionMutation(
        this,
        actionId,
        "talk:update-motion-assignment",
        summarizeUpdates(action?.motions?.[assignmentIndex], updates),
        (actionToUpdate) => {
        if (!actionToUpdate.motions?.[assignmentIndex]) {
          return;
        }
        Object.assign(actionToUpdate.motions[assignmentIndex], updates);
      });
    },

    // 删除一条动作分配
    removeMotionAssignment(actionId, assignmentIndex) {
      const action = findAction(this.projectFileState.actions, actionId);
      const removedItem = action?.motions?.[assignmentIndex];
      markExpressionMutation(
        this,
        actionId,
        "talk:remove-motion-assignment",
        `removed=${summarizeAssignmentItem(removedItem)}`,
        (actionToUpdate) => {
        if (!actionToUpdate.motions) {
          return;
        }
        actionToUpdate.motions.splice(assignmentIndex, 1);
      });
    },

    // 给布局补一份默认分配
    ensureLayoutAssignment(actionId) {
      const action = findAction(this.projectFileState.actions, actionId);
      if (!action || action.type !== "layout" || this.actionHasExpressionData(action)) {
        return false;
      }

      markExpressionMutation(
        this,
        actionId,
        "layout:ensure-assignment",
        "create initialState.motion/expression with empty default",
        (actionToUpdate) => {
        if (actionToUpdate.type !== "layout") {
          return;
        }
        const baseState = actionToUpdate.initialState || {};
        actionToUpdate.initialState = {
          motion: baseState.motion || "",
          expression: baseState.expression || "",
        };
      });
      return true;
    },

    // 删除布局分配
    removeLayoutAssignment(actionId) {
      const action = findAction(this.projectFileState.actions, actionId);
      markExpressionMutation(
        this,
        actionId,
        "layout:remove-assignment",
        `initialState=${shortValue(action?.initialState)}, delay=${shortValue(
          action?.delay
        )} -> removed`,
        (actionToUpdate) => {
        if (actionToUpdate.type !== "layout") {
          return;
        }
        delete actionToUpdate.initialState;
        delete actionToUpdate.delay;
      });
    },

    // 更新布局延迟
    updateLayoutDelay(actionId, delay) {
      const action = findAction(this.projectFileState.actions, actionId);
      markExpressionMutation(
        this,
        actionId,
        "layout:update-delay",
        `delay: ${shortValue(action?.delay)} -> ${shortValue(delay)}`,
        (actionToUpdate) => {
        if (actionToUpdate.type !== "layout") {
          return;
        }
        actionToUpdate.delay = delay;
      });
    },

    // 更新一条分配
    updateAssignment(actionId, assignmentIndex, updates) {
      const action = findAction(this.projectFileState.actions, actionId);
      if (action?.type === "layout") {
        this.updateLayoutInitialState(actionId, updates);
        return;
      }
      this.updateMotionAssignment(actionId, assignmentIndex, updates);
    },

    // 删除一条分配
    removeAssignment(actionId, assignmentIndex) {
      const action = findAction(this.projectFileState.actions, actionId);
      if (action?.type === "layout") {
        this.removeLayoutAssignment(actionId);
        return;
      }
      this.removeMotionAssignment(actionId, assignmentIndex);
    },

    // 更新分配里的延迟
    updateAssignmentDelay(actionId, assignmentIndex, delayValue) {
      const action = findAction(this.projectFileState.actions, actionId);
      if (action?.type === "layout") {
        this.updateLayoutDelay(actionId, delayValue);
        return;
      }
      this.updateMotionAssignment(actionId, assignmentIndex, {
        delay: delayValue,
      });
    },

    // 给分配区绑定拖放
    initSortableForAssignmentZones(assignmentElement) {
      assignmentElement.querySelectorAll(".drop-zone").forEach((zone) => {
        new Sortable(zone, {
          group: {
            name: zone.dataset.type,
            put: (...sortableArgs) =>
              sortableArgs[2].classList.contains("draggable-item"),
          },
          animation: 150,
          onAdd: (sortableEvent) => {
            const droppedValue = sortableEvent.item?.textContent.trim();
            const dropZone = sortableEvent.to;
            const assignmentItem = dropZone.closest(".motion-assignment-item");

            sortableEvent.item.remove();

            if (!droppedValue || !assignmentItem) {
              return;
            }

            const { actionId, assignmentIndex } = resolveAssignmentContext(
              assignmentItem
            );
            const type = dropZone.dataset.type;
            updateDropZoneValue(dropZone, droppedValue, true);
            // 拖进去后更新对应字段
            const updates = { [type]: droppedValue };
            this.updateAssignment(actionId, assignmentIndex, updates);
          },
        });
      });
    },

    // 绑定时间线里的点击和输入事件
    bindTimelineEvents() {
      const timeline = this.domCache.timeline;
      if (!timeline) {
        return;
      }

      timeline.onclick = (clickEvent) => {
        const target = clickEvent.target;
        const timelineCard = target.closest(".timeline-item");
        if (!timelineCard) {
          return;
        }
        const actionId = timelineCard.dataset.id;

        // 点设置按钮时打开设置区
        if (target.matches(".setup-expressions-btn")) {
          const action = findAction(this.projectFileState.actions, actionId);
          const footer = timelineCard.querySelector(".timeline-item-footer");

          // 布局卡片没有分配时先补一个
          if (action?.type === "layout") {
            const created = this.ensureLayoutAssignment(actionId);
            const freshCard =
              (created &&
                this.domCache.timeline?.querySelector(
                  `.layout-item[data-id="${actionId}"]`
                )) ||
              timelineCard;
            assignmentRenderer.showExpressionSetupUI(this, freshCard);
            return;
          }

          // 切换对话卡片的角色选择区
          const previousSelector = footer?.querySelector(
            ".motion-character-selector"
          );
          const shouldOpenAfterRefresh =
            !previousSelector || previousSelector.style.display === "none";
          assignmentRenderer.showExpressionSetupUI(this, timelineCard);
          const newSelector = footer?.querySelector(".motion-character-selector");
          if (newSelector) {
            newSelector.style.display = shouldOpenAfterRefresh ? "block" : "none";
          }
          return;
        }

        // 点角色后新增一条分配
        if (target.matches(".character-selector-item") || target.closest(".character-selector-item")) {
          const characterItem = target.closest(".character-selector-item");
          if (!characterItem) {
            return;
          }
          this.addMotionAssignment(actionId, {
            id: Number.parseInt(characterItem.dataset.characterId, 10),
            name: characterItem.dataset.characterName,
          });
          const footer = timelineCard.querySelector(".timeline-item-footer");
          const characterSelector = footer?.querySelector(
            ".motion-character-selector"
          );
          if (characterSelector) {
            characterSelector.style.display = "none";
          }
          return;
        }

        // 点删除按钮时删掉分配
        if (target.matches(".assignment-remove-btn")) {
          const assignmentContext = resolveAssignmentContext(target);
          if (!assignmentContext) {
            return;
          }
          this.removeAssignment(
            assignmentContext.actionId,
            assignmentContext.assignmentIndex
          );
          return;
        }

        // 点清空按钮时清空当前值
        if (target.matches(".clear-state-btn")) {
          const dropZone = target.closest(".drop-zone");
          const assignmentContext = resolveAssignmentContext(target);
          if (!assignmentContext || !dropZone) {
            return;
          }
          const type = dropZone.dataset.type;
          updateDropZoneValue(dropZone, "--", false);
          const updates = { [type]: "" };
          this.updateAssignment(
            assignmentContext.actionId,
            assignmentContext.assignmentIndex,
            updates
          );
          return;
        }

        // 点布局删除按钮时删掉布局卡片
        if (target.matches(".layout-remove-btn")) {
          const deleteIndex = this.projectFileState.actions.findIndex(
            (actionItem) => actionItem.id === actionId
          );
          if (deleteIndex > -1) {
            this.markLayoutMutationRender(actionId, "delete", {
              startIndex: deleteIndex,
            });
          }
          this.deleteLayoutAction(actionId);
        }
      };

      timeline.onchange = (changeEvent) => {
        const assignmentContext = resolveAssignmentContext(changeEvent.target);
        // 改分配延迟时写回数据
        if (assignmentContext && changeEvent.target.matches(".assignment-delay-input")) {
          const delayValue = Number.parseFloat(changeEvent.target.value) || 0;
          this.updateAssignmentDelay(
            assignmentContext.actionId,
            assignmentContext.assignmentIndex,
            delayValue
          );
          return;
        }

        // 改布局延迟时写回数据
        if (changeEvent.target.matches(".layout-delay-input")) {
          const actionId = changeEvent.target.dataset.actionId;
          const delayValue = Number.parseFloat(changeEvent.target.value) || 0;
          this.updateLayoutDelay(actionId, delayValue);
          return;
        }

        // 改布局输入时写回布局数据
        const layoutCard = changeEvent.target.closest(".layout-item");
        if (layoutCard && changeEvent.target.matches("select, input")) {
          this.updateLayoutActionProperty(layoutCard.dataset.id, changeEvent.target);
        }
      };
    },

    // 重新绑定右侧库的拖拽
    initLibraryDragAndDrop() {
      const sortables = (this.sortableInstances || []).filter(
        (sortableInstance) => sortableInstance?.el
      );
      const timelineElement = this.domCache.timeline;
      const timelineSortable = sortables.find(
        (sortableInstance) =>
          sortableInstance.el === timelineElement ||
          sortableInstance.el?.id === "expressionEditorTimeline"
      );

      // 先清空旧的右侧拖拽实例
      sortables
        .filter((sortableInstance) => sortableInstance !== timelineSortable)
        .forEach((instance) => instance.el && instance.destroy());
      this.sortableInstances = timelineSortable ? [timelineSortable] : [];

      // 重新绑定两种库的拖拽
      LIBRARY_TYPES.forEach((type) => {
        const libraryList = this.domCache[LIBRARY_CONFIG[type].domKey];
        if (!libraryList) {
          return;
        }
        this.sortableInstances.push(
          new Sortable(libraryList, {
            group: { name: type, pull: "clone", put: false },
            sort: false,
            onStart: () => {
              document.addEventListener("dragover", this.handleDragScrolling);
            },
            onEnd: () => {
              document.removeEventListener("dragover", this.handleDragScrolling);
              DragHelper.stopAutoScroll(this);
            },
          })
        );
      });
    },

// 渲染一类库
    renderLibrary(type, items) {
      const libraryListContainer = document.getElementById(`${type}LibraryList`);
      DOMUtils.clearElement(libraryListContainer);

      const itemElements = items.map((itemId) =>
        DOMUtils.createElement(
          "div",
          {
            className: "config-list-item draggable-item",
            draggable: true,
          },
          [DOMUtils.createElement("span", { className: "item-name" }, itemId)]
        )
      );

      DOMUtils.appendChildren(libraryListContainer, itemElements);
    },

// 渲染左右两边的库
    renderLibraries() {
      const stagedCharacterIds = new Set(
        this.collectStagedCharacters().map((character) => character.id)
      );
      LIBRARY_TYPES.forEach((type) => {
        const manager = LIBRARY_CONFIG[type].manager;
        const items = new Set(this.tempLibraryItems[type]);
        stagedCharacterIds.forEach((characterId) => {
          manager
            .listAvailableItemsForCharacter(characterId)
            .forEach((itemId) => items.add(itemId));
        });
        if (stagedCharacterIds.size === 0 || items.size === 0) {
          manager.listKnownItems().forEach((itemId) => items.add(itemId));
        }
        this.renderLibrary(type, Array.from(items).sort());
      });
      this.initLibraryDragAndDrop();
    },

    // 按搜索词过滤库列表
    filterLibraryList(type, inputEvent) {
      const searchTerm = inputEvent.target.value.toLowerCase().trim();
      const listContainer = document.getElementById(LIBRARY_CONFIG[type].listId);
      if (!listContainer) {
        return;
      }
      listContainer
        .querySelectorAll(".config-list-item.draggable-item")
        .forEach((libraryItem) => {
          const itemName = libraryItem.textContent.toLowerCase();
          libraryItem.style.display = itemName.startsWith(searchTerm) ? "" : "none";
        });
    },

    // 添加一个临时动作或表情
    addTempItem(type) {
      const { inputId, manager: targetConfigManager } = LIBRARY_CONFIG[type];
      const idInput = document.getElementById(inputId);
      const tempList = this.tempLibraryItems[type];
      const trimmedId = idInput.value.trim();

      if (!trimmedId) {
        ui.showStatus(`${targetConfigManager.name}ID不能为空！`, "error");
        return;
      }

      const allItems = new Set([
        ...targetConfigManager.listKnownItems(),
        ...tempList,
      ]);
      if (allItems.has(trimmedId)) {
        ui.showStatus(`该${targetConfigManager.name}ID已存在！`, "error");
        return;
      }

      tempList.push(trimmedId);
      idInput.value = "";
      this.renderLibraries();
      ui.showStatus(`已添加临时${targetConfigManager.name}：${trimmedId}`, "success");
    },

    // 打开 Live2D 查看器
    openLive2DViewers() {
      if (!this.projectFileState?.actions) {
        ui.showStatus("没有可分析的剧情内容。", "error");
        window.open(LIVE2D_VIEWER_HOME_URL, "_blank");
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
        window.open(LIVE2D_VIEWER_HOME_URL, "_blank");
        return;
      }

      const costumeArray = Array.from(costumeIds);
      if (
        costumeArray.length > 5 &&
        !confirm(
          `你即将为 ${costumeArray.length} 个不同的服装打开新的浏览器标签页，确定要继续吗？`
        )
      ) {
        return;
      }

      ui.showStatus(
        `正在为 ${costumeArray.length} 个服装打开 Live2D 浏览器...`,
        "success"
      );

      costumeArray.forEach((costumeId) => {
        window.open(
          `https://bestdori.com/tool/live2d/asset/jp/live2d/chara/${costumeId}`,
          "_blank"
        );
      });
    },

    // 读取快速填充选项
    loadQuickFillOptions() {
      const configData = state.configData;
      this.quickFillOptions.default = configData?.quick_fill_options || [];
      this.quickFillOptions.custom =
        storageService.load(STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS) || [];
    },

    // 渲染一个快速填充下拉框
    renderQuickFillDropdown(type) {
      const dropdown = document.getElementById(LIBRARY_CONFIG[type].dropdownId);
      if (!dropdown) {
        return;
      }

      DOMUtils.clearElement(dropdown);

      const defaultOptions = new Set(this.quickFillOptions.default);
      const allOptions = [
        ...new Set([
          ...this.quickFillOptions.default,
          ...this.quickFillOptions.custom,
        ]),
      ].sort();

      allOptions.forEach((option) => {
        const optionButton = DOMUtils.createButton(option, "quick-fill-item");
        optionButton.dataset.type = type;
        optionButton.dataset.value = option;

        if (
          this.quickFillOptions.custom.includes(option) &&
          !defaultOptions.has(option)
        ) {
          // 自定义项可以删掉
          const deleteButton = DOMUtils.createElement("button", {
            className: "quick-fill-delete-btn",
            title: "删除此项",
          });
          deleteButton.dataset.value = option;
          deleteButton.appendChild(
            DOMUtils.createElement(
              "span",
              { className: "material-symbols-outlined" },
              "delete"
            )
          );
          optionButton.appendChild(deleteButton);
        }

        dropdown.appendChild(optionButton);
      });

      if (allOptions.length > 0) {
        dropdown.appendChild(
          DOMUtils.createElement("div", { className: "quick-fill-divider" })
        );
      }
      // 最后加上自定义新增按钮
      const addItem = DOMUtils.createButton(
        "自定义添加...",
        "quick-fill-item quick-fill-add-btn"
      );
      addItem.dataset.type = "add-custom";
      dropdown.appendChild(addItem);
    },

    // 打开或关闭快速填充下拉框
    toggleQuickFillDropdown(type) {
      const dropdown = document.getElementById(LIBRARY_CONFIG[type].dropdownId);
      if (!dropdown) {
        return;
      }

      const toggleButton = dropdown.previousElementSibling;
      const isActive = !dropdown.classList.contains("hidden");
      toggleButton?.classList.toggle("active", !isActive);
      dropdown.classList.toggle("hidden");

      if (!dropdown.classList.contains("hidden")) {
        // 点外面时关掉下拉框
        setTimeout(() => {
          document.addEventListener(
            "click",
            function onClickOutside(clickEvent) {
              if (!dropdown.parentElement.contains(clickEvent.target)) {
                dropdown.classList.add("hidden");
                toggleButton?.classList.remove("active");
                document.removeEventListener("click", onClickOutside);
              }
            },
            { once: true }
          );
        }, 0);
      }
    },

    // 选中一个快速填充值
    handleQuickFillSelect(type, value) {
      const searchInput = document.getElementById(
        LIBRARY_CONFIG[type].searchInputId
      );
      if (searchInput) {
        searchInput.value = value;
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        searchInput.focus();
      }
      this.toggleQuickFillDropdown(type);
    },

    // 新增一个自定义快速填充值
    async addCustomQuickFillOption() {
      const newValue = await modalService.prompt(
        "请输入要添加的自定义快速填充关键词："
      );
      if (!newValue?.trim()) {
        return;
      }

      const trimmedValue = newValue.trim().toLowerCase();
      if (this.quickFillOptions.custom.includes(trimmedValue)) {
        ui.showStatus("该填充项已存在！", "error");
        return;
      }

      this.quickFillOptions.custom.push(trimmedValue);
      storageService.save(
        STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS,
        this.quickFillOptions.custom
      );
      LIBRARY_TYPES.forEach((type) => this.renderQuickFillDropdown(type));
      ui.showStatus(`已添加自定义填充项: ${trimmedValue}`, "success");
    },

    // 删除一个自定义快速填充值
    async deleteCustomQuickFillOption(valueToDelete) {
      const confirmed = await modalService.confirm(
        `确定要删除自定义填充项 "${valueToDelete}" 吗？`
      );
      if (!confirmed) {
        return;
      }

      this.quickFillOptions.custom = this.quickFillOptions.custom.filter(
        (option) => option !== valueToDelete
      );
      storageService.save(
        STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS,
        this.quickFillOptions.custom
      );
      LIBRARY_TYPES.forEach((type) => this.renderQuickFillDropdown(type));
      ui.showStatus(`已删除填充项: ${valueToDelete}`, "success");
    },
  });
}
