import { DOMUtils } from "@utils/DOMUtils.js";
import { editorService } from "@services/EditorService.js";
import { ui } from "@utils/uiUtils.js";
import { state } from "@managers/stateManager.js";

/**
 * 资源库与临时项、Live2D 浏览相关逻辑。
 */
export const libraryPanel = {
  initDragAndDropForLibraries(editor) {
    const timelineSortable = editor.sortableInstances[0];
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
              document.addEventListener("dragover", editor.handleDragScrolling);
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

  renderLibraries(editor) {
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

    editor.initDragAndDropForLibraries();
  },

  renderLibrary(type, items) {
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

  filterLibraryList(type, event) {
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
      item.style.display = itemName.startsWith(searchTerm) ? "" : "none";
    });
  },

  addTempItem(editor, type) {
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

  openLive2dViewers(editor) {
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

  loadQuickFillOptions(editor) {
    const configData = state.get("configData");
    editor.quickFillOptions.default = configData?.quick_fill_options || [];
    editor.quickFillOptions.custom = editor._getCustomQuickFillOptions() || [];
  },
};
