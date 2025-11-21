import { DOMUtils } from "../../utils/DOMUtils.js";
import { editorService } from "../../services/EditorService.js";
import { ui } from "../../utils/uiUtils.js";
import { storageService, STORAGE_KEYS } from "../../services/StorageService.js";
import { state } from "../../managers/stateManager.js";
import { modalService } from "../../services/ModalService.js";

// 资源库、临时项与快速填充相关逻辑
export function attachExpressionLibraries(editor) {
  Object.assign(editor, {
    // 初始化动作和表情资源库的拖放功能
    initDragAndDropForLibraries() {
      // 先销毁资源库相关的 Sortable 实例（只保留 timeline 的实例）
      const timelineSortable = editor.sortableInstances[0]; // timeline 的实例是第一个
      editor.sortableInstances
        .slice(1)
        .forEach((instance) => instance?.destroy());
      editor.sortableInstances = timelineSortable ? [timelineSortable] : [];

      ["motion", "expression"].forEach((type) => {
        const libraryList =
          type === "motion"
            ? editor.domCache.motionList
            : editor.domCache.expressionList;

        if (libraryList) {
          editor.sortableInstances.push(
            new Sortable(libraryList, {
              group: { name: type, pull: "clone", put: false },
              sort: false,
              onStart: () => {
                document.addEventListener(
                  "dragover",
                  editor.handleDragScrolling
                );
              },
              onEnd: () => {
                document.removeEventListener(
                  "dragover",
                  editor.handleDragScrolling
                );
                editor.stopScrolling();
              },
            })
          );
        }
      });
    },

    // 渲染动作和表情资源库（根据在场角色动态生成可用列表）
    renderLibraries() {
      const stagedCharacters = editor._getStagedCharacters();
      const stagedCharacterIds = new Set(stagedCharacters.map((c) => c.id));
      const motionItems = new Set(editor.tempLibraryItems.motion);
      const expressionItems = new Set(editor.tempLibraryItems.expression);
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
      editor._renderLibrary("motion", Array.from(motionItems).sort());
      editor._renderLibrary("expression", Array.from(expressionItems).sort());

      // 渲染完成后初始化拖放
      editor.initDragAndDropForLibraries();
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

    // 添加临时动作或表情项（用户自定义未在配置中的项）
    _addTempItem(type) {
      const isMotion = type === "motion";
      const input = document.getElementById(
        isMotion ? "tempMotionInput" : "tempExpressionInput"
      );
      const manager = isMotion
        ? editorService.motionManager
        : editorService.expressionManager;
      const tempList = editor.tempLibraryItems[type];
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
      editor.renderLibraries();
      ui.showStatus(`已添加临时${manager.name}：${trimmedId}`, "success");
    },

    /**
     * 批量打开Live2D浏览器查看器
     * 扫描当前时间轴中的所有服装ID,为每个服装打开Bestdori Live2D浏览器
     * 超过5个服装时需要用户确认,避免打开过多标签页
     */
    _openLive2dViewers() {
      if (!editor.projectFileState || !editor.projectFileState.actions) {
        ui.showStatus("没有可分析的剧情内容。", "error");
        window.open("https://bestdori.com/tool/live2d", "_blank");
        return;
      }

      const costumeIds = new Set();
      editor.projectFileState.actions.forEach((action) => {
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

    /**
     * 加载默认和自定义的快速填充选项
     */
    _loadQuickFillOptions() {
      const configData = state.get("configData");
      editor.quickFillOptions.default = configData?.quick_fill_options || [];
      editor.quickFillOptions.custom =
        storageService.get(STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS) || [];
    },

    /**
     * 渲染两个快速填充下拉菜单
     */
    _renderQuickFillDropdowns() {
      editor._renderQuickFillDropdown("motion");
      editor._renderQuickFillDropdown("expression");
    },

    /**
     * 渲染单个快速填充下拉菜单
     * @param {'motion' | 'expression'} type
     */
    _renderQuickFillDropdown(type) {
      const dropdownId =
        type === "motion" ? "motionQuickFill" : "expressionQuickFill";
      const dropdown = document.getElementById(dropdownId);
      if (!dropdown) return;

      DOMUtils.clearElement(dropdown);

      // 合并并排序所有选项
      const defaultOptions = new Set(editor.quickFillOptions.default);
      const allOptions = [
        ...new Set([
          ...editor.quickFillOptions.default,
          ...editor.quickFillOptions.custom,
        ]),
      ].sort();

      allOptions.forEach((option) => {
        const item = DOMUtils.createButton(option, "quick-fill-item");
        item.dataset.type = type;
        item.dataset.value = option;

        // 如果是自定义选项，且不是默认选项，则添加删除按钮
        if (
          editor.quickFillOptions.custom.includes(option) &&
          !defaultOptions.has(option)
        ) {
          const deleteBtn = DOMUtils.createElement("button", {
            className: "quick-fill-delete-btn",
            title: "删除此项",
          });
          deleteBtn.dataset.value = option;

          // 使用 Google Icon Font (需要确保 material-symbols.css 已加载)
          const icon = DOMUtils.createElement(
            "span",
            { className: "material-symbols-outlined" },
            "delete"
          );
          deleteBtn.appendChild(icon);

          item.appendChild(deleteBtn);
        }

        dropdown.appendChild(item);
      });

      // 添加分割线和自定义按钮
      if (allOptions.length > 0) {
        dropdown.appendChild(
          DOMUtils.createElement("div", { className: "quick-fill-divider" })
        );
      }
      const addItem = DOMUtils.createButton(
        "自定义添加...",
        "quick-fill-item quick-fill-add-btn"
      );
      addItem.dataset.type = "add-custom";
      dropdown.appendChild(addItem);
    },

    /**
     * 切换下拉菜单的显示/隐藏
     * @param {'motion' | 'expression'} type
     */
    _toggleQuickFillDropdown(type) {
      const dropdownId =
        type === "motion" ? "motionQuickFill" : "expressionQuickFill";
      const dropdown = document.getElementById(dropdownId);
      if (!dropdown) return;

      const btn = dropdown.previousElementSibling;
      const isActive = !dropdown.classList.contains("hidden");
      if (isActive) {
        if (btn) btn.classList.remove("active");
      } else {
        if (btn) btn.classList.add("active");
      }

      dropdown.classList.toggle("hidden");
      // 添加点击外部关闭的逻辑
      if (!dropdown.classList.contains("hidden")) {
        setTimeout(() => {
          document.addEventListener(
            "click",
            function onClickOutside(e) {
              if (!dropdown.parentElement.contains(e.target)) {
                dropdown.classList.add("hidden");
                if (btn) btn.classList.remove("active");
                document.removeEventListener("click", onClickOutside);
              }
            },
            { once: true }
          );
        }, 0);
      }
    },
    /**
     * 处理快速填充项的选择
     * @param {'motion' | 'expression'} type
     * @param {string} value
     */
    _handleQuickFillSelect(type, value) {
      const inputId =
        type === "motion" ? "motionSearchInput" : "expressionSearchInput";
      const input = document.getElementById(inputId);
      if (input) {
        input.value = value;
        // 触发 input 事件以应用筛选
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      }
      // 关闭下拉菜单
      editor._toggleQuickFillDropdown(type);
    },

    /**
     * 添加自定义快速填充选项
     */
    async _addCustomQuickFillOption() {
      const newValue = await modalService.prompt(
        "请输入要添加的自定义快速填充关键词："
      );
      if (newValue && newValue.trim()) {
        const trimmedValue = newValue.trim().toLowerCase();
        if (!editor.quickFillOptions.custom.includes(trimmedValue)) {
          editor.quickFillOptions.custom.push(trimmedValue);
          storageService.set(
            STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS,
            editor.quickFillOptions.custom
          );
          editor._renderQuickFillDropdowns(); // 重新渲染两个下拉菜单以保持同步
          ui.showStatus(`已添加自定义填充项: ${trimmedValue}`, "success");
        } else {
          ui.showStatus("该填充项已存在！", "error");
        }
      }
    },

    /**
     * 删除一个自定义快速填充选项
     * @param {string} valueToDelete
     */
    async _deleteCustomQuickFillOption(valueToDelete) {
      const confirmed = await modalService.confirm(
        `确定要删除自定义填充项 "${valueToDelete}" 吗？`
      );
      if (confirmed) {
        editor.quickFillOptions.custom = editor.quickFillOptions.custom.filter(
          (option) => option !== valueToDelete
        );
        storageService.set(
          STORAGE_KEYS.CUSTOM_QUICK_FILL_OPTIONS,
          editor.quickFillOptions.custom
        );
        editor._renderQuickFillDropdowns(); // 重新渲染以反映删除
        ui.showStatus(`已删除填充项: ${valueToDelete}`, "success");
      }
    },
  });
}
