import { ui } from "@utils/uiUtils.js";
import {
  motionManager,
  expressionManager,
} from "@managers/genericConfigManager.js";
import { DOMUtils } from "@utils/DOMUtils.js";
import { FileUtils } from "@utils/FileUtils.js";

// 管理动作/表情配置页面渲染列表、添加自定义项、删除项、保存到本地
export const motionExpressionManager = {
  tempCustomMotions: [], // 临时自定义动作列表
  tempCustomExpressions: [], // 临时自定义表情列表

  // 初始化：绑定按钮点击与删除事件
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

  // 一次性刷新“动作列表 + 表情列表”
  renderLists() {
    this.renderList("motion");
    this.renderList("expression");
  },

  // 刷新某一个列表（动作或表情）
  renderList(type) {
    const isMotion = type === "motion";
    const targetConfigManager = isMotion ? motionManager : expressionManager;
    const listContainer = document.getElementById(`${type}List`);
    const tempCustomItems = isMotion
      ? this.tempCustomMotions
      : this.tempCustomExpressions;
    DOMUtils.clearElement(listContainer);
    const allDefaultItems = targetConfigManager.getAllDefaultItems();
    const allItems = Array.from(
      new Set([...allDefaultItems, ...tempCustomItems]),
    ).sort();
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

      // 创建这一行的“名称”和“删除按钮”
      const nameSpan = DOMUtils.createElement("span", {
        class: "item-name",
      });
      nameSpan.textContent = itemId;
      listItemElement.appendChild(nameSpan);

      // 自定义项允许删除：显示删除按钮
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

  // 添加自定义动作或表情项
  addItem(type) {
    const isMotion = type === "motion";
    const idInput = document.getElementById(
      isMotion ? "customMotionInput" : "customExpressionInput",
    );
    const targetConfigManager = isMotion ? motionManager : expressionManager;
    const tempList = isMotion
      ? this.tempCustomMotions
      : this.tempCustomExpressions;
    const trimmedId = idInput.value.trim();

    if (!trimmedId) {
      ui.showStatus(`${targetConfigManager.name}ID不能为空！`, "error");
      return;
    }

    const allKnownItems = new Set(targetConfigManager.getAllKnownItems());
    if (allKnownItems.has(trimmedId) || tempList.includes(trimmedId)) {
      ui.showStatus(`该${targetConfigManager.name}ID已存在！`, "error");
      return;
    }

    tempList.push(trimmedId);
    idInput.value = "";
    this.renderList(type);
  },

  // 处理删除自定义项的点击事件
  handleDelete(clickEvent, type) {
    const removeButton = clickEvent.target.closest(".remove-btn");
    if (removeButton) {
      const idToDelete = removeButton.dataset.id;
      if (type === "motion") {
        this.tempCustomMotions = this.tempCustomMotions.filter(
          (id) => id !== idToDelete,
        );
      } else {
        this.tempCustomExpressions = this.tempCustomExpressions.filter(
          (id) => id !== idToDelete,
        );
      }
      this.renderList(type);
    }
  },

  // 保存自定义动作和表情配置
  async save() {
    await ui.withButtonLoading(
      "saveMotionExpressionBtn",
      async () => {
        motionManager.customItems = [...this.tempCustomMotions];
        expressionManager.customItems = [...this.tempCustomExpressions];
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
          this.tempCustomMotions = [];
          this.tempCustomExpressions = [];
          this.renderLists();
          ui.showStatus("已在编辑器中恢复默认，请点击保存以生效。", "info");
        },
        "恢复中...",
      );
    }
  },
};
