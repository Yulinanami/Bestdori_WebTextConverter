// 动作表情编辑器里的交互
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

// 记录局部刷新再执行修改
function markExprChange(editor, actionId, operation, detail, mutate) {
  editor.markCardRender(actionId, { operation, detail });
  editor.executeActionChange(actionId, mutate);
}

function markExprMutation(editor, actionId, operation, detail, mutate) {
  const resolvedDetail =
    typeof detail === "function" ? detail(editor.findActionById(actionId)) : detail;
  markExprChange(editor, actionId, operation, resolvedDetail, mutate);
}

function routeAssignmentAction(editor, actionId, onLayout, onTalk) {
  const isLayout = editor.findActionById(actionId)?.type === "layout";
  return isLayout ? onLayout() : onTalk();
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

// 给编辑器加上动作表情交互
export function attachExprActions(editor) {
  Object.assign(editor, {
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

      if (this.projectFileState?.actions) {
        // 只收集已经通过 appear 登场过的角色
        this.projectFileState.actions.forEach((action) => {
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
    updateInitialState(actionId, updates) {
      markExprMutation(
        this,
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
      });
    },

    // 更新一条动作分配
    updateMotionAssignment(actionId, assignmentIndex, updates) {
      markExprMutation(
        this,
        actionId,
        "talk:update-motion-assignment",
        (action) => summarizeUpdates(action?.motions?.[assignmentIndex], updates),
        (actionToUpdate) => {
        if (!actionToUpdate.motions?.[assignmentIndex]) {
          return;
        }
        Object.assign(actionToUpdate.motions[assignmentIndex], updates);
      });
    },

    // 删除一条动作分配
    removeMotionAssignment(actionId, assignmentIndex) {
      markExprMutation(
        this,
        actionId,
        "talk:remove-motion-assignment",
        (action) =>
          `removed=${summarizeAssignItem(action?.motions?.[assignmentIndex])}`,
        (actionToUpdate) => {
        if (!actionToUpdate.motions) {
          return;
        }
        actionToUpdate.motions.splice(assignmentIndex, 1);
      });
    },

    // 给布局补一份默认分配
    ensureLayoutData(actionId) {
      const action = this.findActionById(actionId);
      if (!action || action.type !== "layout" || this.hasExpressionData(action)) {
        return false;
      }

      markExprMutation(
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
      markExprMutation(
        this,
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
      });
    },

    // 更新布局延迟
    updateLayoutDelay(actionId, delay) {
      markExprMutation(
        this,
        actionId,
        "layout:update-delay",
        (action) =>
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
      routeAssignmentAction(
        this,
        actionId,
        () => this.updateInitialState(actionId, updates),
        () => this.updateMotionAssignment(actionId, assignmentIndex, updates),
      );
    },

    // 删除一条分配
    removeAssignment(actionId, assignmentIndex) {
      routeAssignmentAction(
        this,
        actionId,
        () => this.removeLayoutAssignment(actionId),
        () => this.removeMotionAssignment(actionId, assignmentIndex),
      );
    },

    // 更新分配里的延迟
    setAssignmentDelay(actionId, assignmentIndex, delayValue) {
      routeAssignmentAction(
        this,
        actionId,
        () => this.updateLayoutDelay(actionId, delayValue),
        () =>
          this.updateAssignment(actionId, assignmentIndex, {
            delay: delayValue,
          }),
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

            const { actionId, assignmentIndex } = readAssignCtx(
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

        // 点击事件统一从这一层分发 先处理按钮 再处理卡片里的区域
        // 点设置按钮时打开设置区
        if (target.matches(".setup-expressions-btn")) {
          const action = this.findActionById(actionId);
          const footer = timelineCard.querySelector(".timeline-item-footer");

          // 布局卡片没有分配时先补一个
          if (action?.type === "layout") {
            const created = this.ensureLayoutData(actionId);
            const freshCard =
              (created &&
                this.domCache.timeline?.querySelector(
                  `.layout-item[data-id="${actionId}"]`
                )) ||
              timelineCard;
            assignUI.showSetupUI(this, freshCard);
            return;
          }

          // 切换对话卡片的角色选择区
          const previousSelector = footer?.querySelector(
            ".motion-character-selector"
          );
          const shouldOpen =
            !previousSelector || previousSelector.style.display === "none";
          assignUI.showSetupUI(this, timelineCard);
          const newSelector = footer?.querySelector(".motion-character-selector");
          if (newSelector) {
            newSelector.style.display = shouldOpen ? "block" : "none";
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
          const assignmentContext = readAssignCtx(target);
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
          const assignmentContext = readAssignCtx(target);
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
          const deleteIndex = this.findActionIndexById(actionId);
          if (deleteIndex > -1) {
            this.markLayoutMutation(actionId, "delete", {
              startIndex: deleteIndex,
            });
          }
          this.deleteLayoutAction(actionId);
        }
      };

      timeline.onchange = (changeEvent) => {
        const assignmentContext = readAssignCtx(changeEvent.target);
        // 改分配延迟时写回数据
        if (assignmentContext && changeEvent.target.matches(".assignment-delay-input")) {
          const delayValue = Number.parseFloat(changeEvent.target.value) || 0;
          this.setAssignmentDelay(
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
          this.updateLayoutField(layoutCard.dataset.id, changeEvent.target);
        }
      };
    },

    // 重新绑定右侧库的拖拽
    initLibraryDnD() {
      const sortables = (this.sortableInstances || []).filter(
        (sortableInstance) => sortableInstance?.el
      );
      const timelineElement = this.domCache.timeline;
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
      this.sortableInstances = timelineSortable ? [timelineSortable] : [];

      // 重新绑定两种库的拖拽
      LIB_TYPES.forEach((type) => {
        const libraryList = this.domCache[LIB_CFG[type].domKey];
        if (!libraryList) {
          return;
        }
        this.sortableInstances.push(
          new Sortable(libraryList, {
            group: { name: type, pull: "clone", put: false },
            sort: false,
            // 开始拖动时打开自动滚动
            onStart: () => {
              document.addEventListener("dragover", this.handleDragScrolling);
            },
            // 结束拖动时关掉自动滚动
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
        this.listStagedChars().map((character) => character.id)
      );
      LIB_TYPES.forEach((type) => {
        const manager = LIB_CFG[type].manager;
        const items = new Set(this.tempItems[type]);
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
        this.renderLibrary(type, Array.from(items).sort());
      });
      this.initLibraryDnD();
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
      const tempList = this.tempItems[type];
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
        window.open(VIEWER_URL, "_blank");
        return;
      }

      const costumeIds = new Set();
      // 先从当前时间线里收集实际出现过的服装
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
      this.quickFill.default = configData?.quick_fill_options || [];
      this.quickFill.custom =
        storageService.load(STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS) || [];
    },

// 渲染一个快速填充下拉框
    renderQuickFill(type) {
      const dropdown = document.getElementById(LIB_CFG[type].dropdownId);
      if (!dropdown) {
        return;
      }

      DOMUtils.clearElement(dropdown);

      const defaultOptions = new Set(this.quickFill.default);
      // 默认项和自定义项合并后统一排序
      const allOptions = [
        ...new Set([
          ...this.quickFill.default,
          ...this.quickFill.custom,
        ]),
      ].sort();

      allOptions.forEach((option) => {
        const optionButton = DOMUtils.createButton(option, "quick-fill-item");
        optionButton.dataset.type = type;
        optionButton.dataset.value = option;

        if (
          this.quickFill.custom.includes(option) &&
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
      this.toggleQuickFill(type);
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
      if (this.quickFill.custom.includes(trimmedValue)) {
        ui.showStatus("该填充项已存在！", "error");
        return;
      }

      this.quickFill.custom.push(trimmedValue);
      storageService.save(
        STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS,
        this.quickFill.custom
      );
      LIB_TYPES.forEach((type) => this.renderQuickFill(type));
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

      this.quickFill.custom = this.quickFill.custom.filter(
        (option) => option !== valueToDelete
      );
      storageService.save(
        STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS,
        this.quickFill.custom
      );
      LIB_TYPES.forEach((type) => this.renderQuickFill(type));
      ui.showStatus(`已删除填充项: ${valueToDelete}`, "success");
    },
  });
}
