// 动作和表情配置
import { ui } from "@utils/uiUtils.js";
import { DOMUtils } from "@utils/DOMUtils.js";
import { DataUtils } from "@utils/DataUtils.js";
import { FileUtils } from "@utils/FileUtils.js";
import { state } from "@managers/stateManager.js";

class ItemConfig {
  // 创建动作或表情管理器
  constructor(name, configKey, storeKey) {
    this.name = name;
    this.configKey = configKey;
    this.storeKey = storeKey;
    this.characterItems = {};
    this.customItems = this.loadCustomItems();
  }

  // 初始化默认数据
  init() {
    const configData = state.configData;
    if (configData && configData[this.configKey]) {
      this.characterItems = configData[this.configKey];
      return;
    }
    console.warn(`配置中未找到 ${this.configKey}。`);
  }

  // 读取自定义项
  loadCustomItems() {
    try {
      const saved = localStorage.getItem(this.storeKey);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error(`加载自定义 ${this.name} 失败:`, error);
      return [];
    }
  }

  // 保存自定义项
  saveCustomItems() {
    try {
      localStorage.setItem(
        this.storeKey,
        JSON.stringify(this.customItems),
      );
    } catch {
      ui.showStatus(`保存自定义 ${this.name} 失败`, "error");
    }
  }

  // 读取默认项
  listDefaultItems() {
    const defaultItems = new Set();
    Object.values(this.characterItems).forEach((itemList) => {
      itemList.forEach((itemId) => defaultItems.add(itemId));
    });
    return defaultItems;
  }

  // 读取某个角色可用的项
  listCharacterItems(characterId) {
    const defaultItems = this.characterItems[characterId] || [];
    // 默认项和自定义项合并后统一排序
    return Array.from(new Set([...defaultItems, ...this.customItems])).sort();
  }

  // 读取所有已知项
  listKnownItems() {
    const allItems = new Set(this.customItems);
    Object.values(this.characterItems).forEach((itemList) => {
      itemList.forEach((itemId) => allItems.add(itemId));
    });
    // 把全部来源的项合成一个有序列表
    return Array.from(allItems).sort();
  }
}

export const motionManager = new ItemConfig(
  "动作",
  "character_motions",
  "bestdori_custom_motions",
);

export const expressionManager = new ItemConfig(
  "表情",
  "character_expressions",
  "bestdori_custom_expressions",
);

// 动作表情设置页
export const motionExprManager = {
  tempMotions: [], // 临时动作
  tempExpressions: [], // 临时表情

  // 初始化设置页
  init() {
    document
      .getElementById("addCustomMotionBtn")
      ?.addEventListener("click", () => this.addItem("motion"));
    document
      .getElementById("addCustomExpressionBtn")
      ?.addEventListener("click", () => this.addItem("expression"));
    document
      .getElementById("resetMotionExpressionBtn")
      ?.addEventListener("click", () => this.reset());
    document
      .getElementById("saveMotionExpressionBtn")
      ?.addEventListener("click", () => this.save());
    document
      .getElementById("motionList")
      ?.addEventListener("click", (clickEvent) =>
        this.handleDelete(clickEvent, "motion")
      );
    document
      .getElementById("expressionList")
      ?.addEventListener("click", (clickEvent) =>
        this.handleDelete(clickEvent, "expression")
      );
  },

  // 刷新两个列表
  renderLists() {
    this.renderList("motion");
    this.renderList("expression");
  },

  // 进入页面前准备临时数据
  prepareStep() {
    this.tempMotions = DataUtils.deepClone(motionManager.customItems);
    this.tempExpressions = DataUtils.deepClone(
      expressionManager.customItems,
    );
    this.renderLists();
  },

  // 刷新一个列表
  renderList(type) {
    const isMotion = type === "motion";
    const targetConfigManager = isMotion ? motionManager : expressionManager;
    const listContainer = document.getElementById(`${type}List`);
    const tempCustomItems = isMotion
      ? this.tempMotions
      : this.tempExpressions;
    DOMUtils.clearElement(listContainer);
    const allDefaultItems = targetConfigManager.listDefaultItems();
    // 默认项和临时项合并后统一排序
    const allItems = Array.from(new Set([...allDefaultItems, ...tempCustomItems])).sort();
    const fragment = document.createDocumentFragment();
    allItems.forEach((itemId) => {
      const isCustom =
        !allDefaultItems.has(itemId) && tempCustomItems.includes(itemId);
      const listItemElement = document.createElement("div");
      listItemElement.className = "config-list-item";

      if (isCustom) {
        listItemElement.classList.add("is-custom");
      }
      const isDeletable = tempCustomItems.includes(itemId);

      // 先创建名称
      const nameSpan = DOMUtils.createElement("span", {
        class: "item-name",
      });
      nameSpan.textContent = itemId;
      listItemElement.appendChild(nameSpan);

      // 自定义项可以删掉
      if (isDeletable) {
        const removeButton = DOMUtils.createElement("button", {
          className: "btn-icon-action btn-icon-danger remove-btn",
          "data-id": itemId,
          title: "删除此项",
        });
        const icon = DOMUtils.createElement(
          "span",
          { className: "material-symbols-outlined" },
          "delete",
        );
        removeButton.appendChild(icon);
        listItemElement.appendChild(removeButton);
      }

      fragment.appendChild(listItemElement);
    });
    listContainer.appendChild(fragment);
  },

  // 添加一个自定义项
  addItem(type) {
    const isMotion = type === "motion";
    const idInput = document.getElementById(
      isMotion ? "customMotionInput" : "customExpressionInput",
    );
    const targetConfigManager = isMotion ? motionManager : expressionManager;
    const tempList = isMotion
      ? this.tempMotions
      : this.tempExpressions;
    const trimmedId = idInput.value.trim();

    if (!trimmedId) {
      ui.showStatus(`${targetConfigManager.name}ID不能为空！`, "error");
      return;
    }

    const allKnownItems = new Set(targetConfigManager.listKnownItems());
    if (allKnownItems.has(trimmedId) || tempList.includes(trimmedId)) {
      ui.showStatus(`该${targetConfigManager.name}ID已存在！`, "error");
      return;
    }

    tempList.push(trimmedId);
    idInput.value = "";
    this.renderList(type);
  },

  // 删除一个自定义项
  handleDelete(clickEvent, type) {
    const removeButton = clickEvent.target.closest(".remove-btn");
    if (removeButton) {
      const idToDelete = removeButton.dataset.id;
      if (type === "motion") {
        this.tempMotions = this.tempMotions.filter(
          (id) => id !== idToDelete,
        );
      } else {
        this.tempExpressions = this.tempExpressions.filter(
          (id) => id !== idToDelete,
        );
      }
      this.renderList(type);
    }
  },

  // 保存动作表情配置
  async save() {
    await ui.withButtonLoading(
      "saveMotionExpressionBtn",
      async () => {
        motionManager.customItems = [...this.tempMotions];
        expressionManager.customItems = [...this.tempExpressions];
        motionManager.saveCustomItems();
        expressionManager.saveCustomItems();
        await FileUtils.delay(300);
        ui.showStatus("动作/表情配置已保存！", "success");
      },
      "保存中...",
    );
  },

  // 恢复默认列表（清空自定义项）
  async reset() {
    if (
      confirm(
        "确定要恢复默认列表吗？您在此窗口中添加或删除的所有自定义项都将被丢弃。",
      )
    ) {
      await ui.withButtonLoading(
        "resetMotionExpressionBtn",
        async () => {
          await FileUtils.delay(300);
          this.tempMotions = [];
          this.tempExpressions = [];
          this.renderLists();
          ui.showStatus("已在编辑器中恢复默认，请点击保存以生效。", "info");
        },
        "恢复中...",
      );
    }
  },
};
