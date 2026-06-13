// 动作表情编辑器里的交互（组合工厂模式重构）
import { DOMUtils } from "@utils/DOMUtils.js";
import { ui } from "@utils/uiUtils.js";
import { configManager } from "@managers/configManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { modalService } from "@services/ModalService.js";
import { state } from "@managers/stateManager.js";
import { motionManager, expressionManager } from "@managers/motionExprManager.js";
import { bindOutsideClickDismiss } from "@editors/common/editorCore.js";
import { assignUI } from "@editors/expression/exprAssignRenderer.js";
import { shortValue } from "@editors/common/changeSummaryUtils.js";
import { DragHelper } from "@editors/common/DragHelper.js";

// 库的类型
const LIB_TYPES = ["motion", "expression"];
// 每种库对应的配置
const LIB_CFG = {
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
const VIEWER_URL = "https://bestdori.com/tool/live2d";

// 把一条分配内容压成短文字
function summarizeAssignItem(item) {
  if (!item) {
    return "none";
  }
  return `character=${item.character}, motion=${shortValue(
    item.motion
  )}, expression=${shortValue(item.expression)}, delay=${shortValue(item.delay)}`;
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

// 读取一条分配项的上下文
function readAssignCtx(target) {
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

function rerenderCardFooter(actions, actionId) {
  if (!actionId) {
    return;
  }

  const action = actions.findActionById(actionId);
  const timelineCard = actions.getDomCache().timeline?.querySelector(
    `.timeline-item[data-id="${actionId}"]`
  );
  if (action && timelineCard) {
    assignUI.renderCardFooter(actions.getEditorInstance(), timelineCard, { action });
  }
}

// 创建动作表情交互行为闭包组合工厂
export function createExpressionBehavior(deps) {
  const {
    getProjectFileState,
    getDomCache,
    getActiveExpressionCardId,
    setActiveExpressionCardId,
    getTempItems,
    getQuickFill,
    getSortableInstances,
    setSortableInstances,
    findActionById,
    findActionIndexById,
    markCardRender,
    executeActionChange,
    markLayoutMutation,
    deleteLayoutAction,
    updateLayoutField,
    getEditorInstance,
    getDragScrollHandler,
  } = deps;

  // 内部辅助函数，直接利用闭包
  function markExprChange(actionId, operation, detail, mutate) {
    markCardRender(actionId, { operation, detail });
    executeActionChange(actionId, mutate);
  }

  function markExprMutation(actionId, operation, detail, mutate) {
    const resolvedDetail =
      typeof detail === "function" ? detail(findActionById(actionId)) : detail;
    markExprChange(actionId, operation, resolvedDetail, mutate);
  }

  function routeAssignmentAction(actionId, onLayout, onTalk) {
    const isLayout = findActionById(actionId)?.type === "layout";
    return isLayout ? onLayout() : onTalk();
  }

  const actions = {
    // 动作表情相关的 findActionById 暴露供外部和时间线使用
    findActionById(actionId) {
      return findActionById(actionId);
    },
    getEditorInstance() {
      return getEditorInstance();
    },
    getDomCache() {
      return getDomCache();
    },
    get handleDragScrolling() {
      return getDragScrollHandler();
    },

    // 看这条动作有没有动作表情数据
    hasExpressionData(action) {
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
    listStagedChars() {
      const seenChars = new Set();
      const characters = [];
      const projectFileState = getProjectFileState();

      if (projectFileState?.actions) {
        // 只收集已经通过 appear 登场过的角色
        projectFileState.actions.forEach((action) => {
          if (action.type !== "layout" || action.layoutType !== "appear") {
            return;
          }
          const characterName =
            action.characterName || configManager.findCharName(action.characterId);
          if (characterName && !seenChars.has(characterName)) {
            seenChars.add(characterName);
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
      markExprChange(
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
        }
      );
    },

    // 更新布局的初始动作表情
    updateInitialState(actionId, updates) {
      markExprMutation(
        actionId,
        "layout:update-initial-state",
        (action) => summarizeUpdates(action?.initialState, updates),
        (actionToUpdate) => {
          if (actionToUpdate.type !== "layout") {
            return;
          }
          if (!actionToUpdate.initialState) {
            actionToUpdate.initialState = {};
          }
          Object.assign(actionToUpdate.initialState, updates);
        }
      );
    },

    // 更新一条动作分配
    updateMotionAssignment(actionId, assignmentIndex, updates) {
      markExprMutation(
        actionId,
        "talk:update-motion-assignment",
        (action) => summarizeUpdates(action?.motions?.[assignmentIndex], updates),
        (actionToUpdate) => {
          if (!actionToUpdate.motions?.[assignmentIndex]) {
            return;
          }
          Object.assign(actionToUpdate.motions[assignmentIndex], updates);
        }
      );
    },

    // 删除一条动作分配
    removeMotionAssignment(actionId, assignmentIndex) {
      markExprMutation(
        actionId,
        "talk:remove-motion-assignment",
        (action) =>
          `removed=${summarizeAssignItem(action?.motions?.[assignmentIndex])}`,
        (actionToUpdate) => {
          if (!actionToUpdate.motions) {
            return;
          }
          actionToUpdate.motions.splice(assignmentIndex, 1);
        }
      );
    },

    // 删除布局分配
    removeLayoutAssignment(actionId) {
      markExprMutation(
        actionId,
        "layout:remove-assignment",
        (action) =>
          `initialState=${shortValue(action?.initialState)}, delay=${shortValue(
            action?.delay
          )} -> removed`,
        (actionToUpdate) => {
          if (actionToUpdate.type !== "layout") {
            return;
          }
          delete actionToUpdate.initialState;
          delete actionToUpdate.delay;
        }
      );
    },

    // 更新布局延迟
    updateLayoutDelay(actionId, delay) {
      markExprMutation(
        actionId,
        "layout:update-delay",
        (action) =>
          `delay: ${shortValue(action?.delay)} -> ${shortValue(delay)}`,
        (actionToUpdate) => {
          if (actionToUpdate.type !== "layout") {
            return;
          }
          actionToUpdate.delay = delay;
        }
      );
    },

    // 更新一条分配
    updateAssignment(actionId, assignmentIndex, updates) {
      routeAssignmentAction(
        actionId,
        () => actions.updateInitialState(actionId, updates),
        () => actions.updateMotionAssignment(actionId, assignmentIndex, updates)
      );
    },

    // 删除一条分配
    removeAssignment(actionId, assignmentIndex) {
      routeAssignmentAction(
        actionId,
        () => actions.removeLayoutAssignment(actionId),
        () => actions.removeMotionAssignment(actionId, assignmentIndex)
      );
    },

    // 更新分配里的延迟
    setAssignmentDelay(actionId, assignmentIndex, delayValue) {
      routeAssignmentAction(
        actionId,
        () => actions.updateLayoutDelay(actionId, delayValue),
        () =>
          actions.updateAssignment(actionId, assignmentIndex, {
            delay: delayValue,
          })
      );
    },

    // 给分配区绑定拖放
    initAssignSortables(assignmentElement) {
      assignmentElement.querySelectorAll(".drop-zone").forEach((zone) => {
        new Sortable(zone, {
          group: {
            name: zone.dataset.type,
            // 只接收资源库里拖出来的条目
            put: (...sortableArgs) =>
              sortableArgs[2].classList.contains("draggable-item"),
          },
          animation: 150,
          // 放下后把拖入值写回当前分配区
          onAdd: (sortableEvent) => {
            const droppedValue = sortableEvent.item?.textContent.trim();
            const dropZone = sortableEvent.to;
            const assignmentItem = dropZone.closest(".motion-assignment-item");

            sortableEvent.item.remove();

            if (!droppedValue || !assignmentItem) {
              return;
            }

            const ctx = readAssignCtx(assignmentItem);
            if (!ctx) return;
            const { actionId, assignmentIndex } = ctx;
            const type = dropZone.dataset.type;
            updateDropZoneValue(dropZone, droppedValue, true);
            // 拖进去后更新对应字段
            const updates = { [type]: droppedValue };
            actions.updateAssignment(actionId, assignmentIndex, updates);
          },
        });
      });
    },

    // 绑定时间线里的点击和输入事件
    bindTimelineEvents() {
      const timeline = getDomCache().timeline;
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

        // 点击事件统一从这一层分发 先处理按钮 再处理卡片里的区域
        if (target.matches(".expr-card-trigger") || target.closest(".expr-card-trigger")) {
          const previousActionId = getActiveExpressionCardId();
          const nextActionId = previousActionId === actionId ? null : actionId;
          setActiveExpressionCardId(nextActionId);

          if (previousActionId && previousActionId !== actionId) {
            rerenderCardFooter(actions, previousActionId);
          }
          rerenderCardFooter(actions, actionId);
          return;
        }

        // 点设置按钮时打开设置区
        if (target.matches(".setup-expressions-btn")) {
          const footer = timelineCard.querySelector(".timeline-item-footer");
          const characterSelector = footer?.querySelector(".motion-character-selector");
          if (characterSelector) {
            characterSelector.style.display =
              characterSelector.style.display === "none" ? "block" : "none";
          }
          return;
        }

        // 点角色后新增一条分配
        if (target.matches(".character-selector-item") || target.closest(".character-selector-item")) {
          const characterItem = target.closest(".character-selector-item");
          if (!characterItem) {
            return;
          }
          actions.addMotionAssignment(actionId, {
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
          const assignmentContext = readAssignCtx(target);
          if (!assignmentContext) {
            return;
          }
          actions.removeAssignment(
            assignmentContext.actionId,
            assignmentContext.assignmentIndex
          );
          return;
        }

        // 点清空按钮时清空当前值
        if (target.matches(".clear-state-btn")) {
          const dropZone = target.closest(".drop-zone");
          const assignmentContext = readAssignCtx(target);
          if (!assignmentContext || !dropZone) {
            return;
          }
          const type = dropZone.dataset.type;
          updateDropZoneValue(dropZone, "--", false);
          const updates = { [type]: "" };
          actions.updateAssignment(
            assignmentContext.actionId,
            assignmentContext.assignmentIndex,
            updates
          );
          return;
        }

        // 点布局删除按钮时删掉布局卡片
        if (target.closest(".layout-remove-btn")) {
          const deleteIndex = findActionIndexById(actionId);
          if (deleteIndex > -1) {
            markLayoutMutation(actionId, "delete", {
              startIndex: deleteIndex,
            });
          }
          if (getActiveExpressionCardId() === actionId) {
            setActiveExpressionCardId(null);
          }
          deleteLayoutAction(actionId);
        }
      };

      timeline.onchange = (changeEvent) => {
        const assignmentContext = readAssignCtx(changeEvent.target);
        // 改分配延迟时写回数据
        if (assignmentContext && changeEvent.target.matches(".assignment-delay-input")) {
          const delayValue = Number.parseFloat(changeEvent.target.value) || 0;
          actions.setAssignmentDelay(
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
          actions.updateLayoutDelay(actionId, delayValue);
          return;
        }

        // 改布局输入时写回布局数据
        const layoutCard = changeEvent.target.closest(".layout-item");
        if (layoutCard && changeEvent.target.matches("select, input")) {
          updateLayoutField(layoutCard.dataset.id, changeEvent.target);
        }
      };
    },

    // 重新绑定右侧库的拖拽
    initLibraryDnD() {
      const sortables = (getSortableInstances() || []).filter(
        (sortableInstance) => sortableInstance?.el
      );
      const timelineElement = getDomCache().timeline;
      const timelineSortable = sortables.find(
        (sortableInstance) =>
          sortableInstance.el === timelineElement ||
          sortableInstance.el?.id === "expressionEditorTimeline"
      );

      // 时间线拖拽保留 右侧资源库拖拽每次重建
      // 先清空旧的右侧拖拽实例
      sortables
        .filter((sortableInstance) => sortableInstance !== timelineSortable)
        .forEach((instance) => instance.el && instance.destroy());
      
      const newSortableInstances = timelineSortable ? [timelineSortable] : [];
      setSortableInstances(newSortableInstances);

      // 重新绑定两种库的拖拽
      LIB_TYPES.forEach((type) => {
        const libraryList = getDomCache()[LIB_CFG[type].domKey];
        if (!libraryList) {
          return;
        }
        
        const inst = new Sortable(libraryList, {
          group: { name: type, pull: "clone", put: false },
          sort: false,
          // 开始拖动时打开自动滚动
          onStart: () => {
            document.addEventListener("dragover", actions.handleDragScrolling);
          },
          // 结束拖动时关掉自动滚动
          onEnd: () => {
            document.removeEventListener("dragover", actions.handleDragScrolling);
            DragHelper.stopAutoScroll(actions.getEditorInstance());
          },
        });
        
        const currentInstances = getSortableInstances();
        currentInstances.push(inst);
        setSortableInstances(currentInstances);
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
        actions.listStagedChars().map((character) => character.id)
      );
      LIB_TYPES.forEach((type) => {
        const manager = LIB_CFG[type].manager;
        const items = new Set(getTempItems()[type]);
        // 先合并临时项和已登场角色可用项 空项目时再退回全部已知项
        stagedCharacterIds.forEach((characterId) => {
          manager
            .listCharacterItems(characterId)
            .forEach((itemId) => items.add(itemId));
        });
        if (stagedCharacterIds.size === 0 || items.size === 0) {
          manager.listKnownItems().forEach((itemId) => items.add(itemId));
        }
        // 最后再统一排序 让左右库顺序稳定
        actions.renderLibrary(type, Array.from(items).sort());
      });
      actions.initLibraryDnD();
    },

    // 按搜索词过滤库列表
    filterLibraryList(type, inputEvent) {
      const searchTerm = inputEvent.target.value.toLowerCase().trim();
      const listContainer = document.getElementById(LIB_CFG[type].listId);
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
      const { inputId, manager: targetConfigManager } = LIB_CFG[type];
      const idInput = document.getElementById(inputId);
      const tempList = getTempItems()[type];
      const trimmedId = idInput?.value?.trim();

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
      if (idInput) idInput.value = "";
      actions.renderLibraries();
      ui.showStatus(`已添加临时${targetConfigManager.name}：${trimmedId}`, "success");
    },

    // 打开 Live2D 查看器
    openLive2DViewers() {
      const projectFileState = getProjectFileState();
      if (!projectFileState?.actions) {
        ui.showStatus("没有可分析的剧情内容。", "error");
        window.open(VIEWER_URL, "_blank");
        return;
      }

      const costumeIds = new Set();
      // 先从当前时间线里收集实际出现过的服装
      projectFileState.actions.forEach((action) => {
        if (action.type === "layout" && action.costume) {
          costumeIds.add(action.costume);
        }
      });

      if (costumeIds.size === 0) {
        ui.showStatus(
          "当前时间线中未找到任何服装配置，将打开 Live2D 浏览器首页。",
          "info"
        );
        window.open(VIEWER_URL, "_blank");
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
      const quickFill = getQuickFill();
      quickFill.default = configData?.quick_fill_options || [];
      quickFill.custom =
        storageService.load(STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS) || [];
    },

    // 渲染一个快速填充下拉框
    renderQuickFill(type) {
      const dropdown = document.getElementById(LIB_CFG[type].dropdownId);
      if (!dropdown) {
        return;
      }

      DOMUtils.clearElement(dropdown);

      const quickFill = getQuickFill();
      const defaultOptions = new Set(quickFill.default);
      // 默认项和自定义项合并后统一排序
      const allOptions = [
        ...new Set([
          ...quickFill.default,
          ...quickFill.custom,
        ]),
      ].sort();

      allOptions.forEach((option) => {
        const optionButton = DOMUtils.createButton(option, "quick-fill-item");
        optionButton.dataset.type = type;
        optionButton.dataset.value = option;

        if (
          quickFill.custom.includes(option) &&
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
    toggleQuickFill(type) {
      const dropdown = document.getElementById(LIB_CFG[type].dropdownId);
      if (!dropdown) {
        return;
      }

      const toggleButton = dropdown.previousElementSibling;
      const isActive = !dropdown.classList.contains("hidden");
      toggleButton?.classList.toggle("active", !isActive);
      dropdown.classList.toggle("hidden");

      if (!dropdown.classList.contains("hidden")) {
        // 展开后只监听一次外部点击 用来收起当前下拉框
        // 点外面时关掉下拉框
        bindOutsideClickDismiss(dropdown.parentElement, () => {
          dropdown.classList.add("hidden");
          toggleButton?.classList.remove("active");
        });
      }
    },

    // 选中一个快速填充值
    applyQuickFill(type, value) {
      const searchInput = document.getElementById(
        LIB_CFG[type].searchInputId
      );
      if (searchInput) {
        searchInput.value = value;
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        searchInput.focus();
      }
      actions.toggleQuickFill(type);
    },

    // 新增一个自定义快速填充值
    async addQuickFillOption() {
      const newValue = await modalService.prompt(
        "请输入要添加的自定义快速填充关键词："
      );
      if (!newValue?.trim()) {
        return;
      }

      const trimmedValue = newValue.trim().toLowerCase();
      const quickFill = getQuickFill();
      if (quickFill.custom.includes(trimmedValue)) {
        ui.showStatus("该填充项已存在！", "error");
        return;
      }

      quickFill.custom.push(trimmedValue);
      storageService.save(
        STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS,
        quickFill.custom
      );
      LIB_TYPES.forEach((type) => actions.renderQuickFill(type));
      ui.showStatus(`已添加自定义填充项: ${trimmedValue}`, "success");
    },

    // 删除一个自定义快速填充值
    async removeQuickFill(valueToDelete) {
      const confirmed = await modalService.confirm(
        `确定要删除自定义填充项 "${valueToDelete}" 吗？`
      );
      if (!confirmed) {
        return;
      }

      const quickFill = getQuickFill();
      quickFill.custom = quickFill.custom.filter(
        (option) => option !== valueToDelete
      );
      storageService.save(
        STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS,
        quickFill.custom
      );
      LIB_TYPES.forEach((type) => actions.renderQuickFill(type));
      ui.showStatus(`已删除填充项: ${valueToDelete}`, "success");
    },
  };

  return actions;
}
