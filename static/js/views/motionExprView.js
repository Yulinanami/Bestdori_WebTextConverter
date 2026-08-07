// 动作表情库列表渲染界面管理（拆分自原动作表情配置管理器）
import { ui } from "@utils/uiUtils.js";
import { DOMUtils } from "@utils/DOMUtils.js";
import { FileUtils } from "@utils/FileUtils.js";
import { motionManager, expressionManager } from "@managers/motionExprManager.js";

export const motionExprView = {
  manager: null,

  // 初始化绑定各按钮与列表事件
  init(manager) {
    this.manager = manager;

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

  // 刷新两侧的动作和表情列表
  renderLists() {
    this.renderList("motion");
    this.renderList("expression");
  },

  // 渲染指定的列表（动作或表情）
  renderList(type) {
    if (!this.manager) return;
    const isMotion = type === "motion";
    const targetConfigManager = isMotion ? motionManager : expressionManager;
    const listContainer = document.getElementById(`${type}List`);
    if (!listContainer) return;

    const tempCustomItems = isMotion
      ? this.manager.tempMotions
      : this.manager.tempExpressions;
    DOMUtils.clearElement(listContainer);

    const allDefaultItems = targetConfigManager.listDefaultItems();
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

      const nameSpan = DOMUtils.createElement("span", {
        class: "item-name",
      });
      nameSpan.textContent = itemId;
      listItemElement.appendChild(nameSpan);

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

  // 页面添加一个自定义项
  addItem(type) {
    if (!this.manager) return;
    const isMotion = type === "motion";
    const idInput = document.getElementById(
      isMotion ? "customMotionInput" : "customExpressionInput",
    );
    if (!idInput) return;

    const targetConfigManager = isMotion ? motionManager : expressionManager;
    const tempList = isMotion
      ? this.manager.tempMotions
      : this.manager.tempExpressions;
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

  // 处理列表行的删除点击
  handleDelete(clickEvent, type) {
    if (!this.manager) return;
    const removeButton = clickEvent.target.closest(".remove-btn");
    if (removeButton) {
      const idToDelete = removeButton.dataset.id;
      const itemType = type === "motion" ? "动作" : "表情";
      if (!confirm(`确定要删除${itemType}“${idToDelete}”吗？`)) return;
      if (type === "motion") {
        this.manager.tempMotions = this.manager.tempMotions.filter(
          (id) => id !== idToDelete,
        );
      } else {
        this.manager.tempExpressions = this.manager.tempExpressions.filter(
          (id) => id !== idToDelete,
        );
      }
      this.renderList(type);
    }
  },

  // 保存数据UI交互联动
  async save() {
    if (!this.manager) return;
    await ui.withButtonLoading(
      "saveMotionExpressionBtn",
      async () => {
        this.manager.saveData();
        await FileUtils.delay(300);
        ui.showStatus("动作/表情配置已保存！", "success");
      },
      "保存中...",
    );
  },

  // 恢复默认数据交互联动
  async reset() {
    if (!this.manager) return;
    if (
      confirm(
        "确定要恢复默认列表吗？您在此窗口中添加或删除的所有自定义项都将被丢弃。",
      )
    ) {
      await ui.withButtonLoading(
        "resetMotionExpressionBtn",
        async () => {
          await FileUtils.delay(300);
          this.manager.tempMotions = [];
          this.manager.tempExpressions = [];
          this.renderLists();
          ui.showStatus("已在编辑器中恢复默认，请点击保存以生效。", "info");
        },
        "恢复中...",
      );
    }
  },
};
