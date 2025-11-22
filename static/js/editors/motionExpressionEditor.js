import { ui } from "@utils/uiUtils.js";
import {
  motionManager,
  expressionManager,
} from "@managers/genericConfigManager.js";
import { DOMUtils } from "@utils/DOMUtils.js";

export const motionExpressionEditor = {
  tempCustomMotions: [], // 临时自定义动作列表
  tempCustomExpressions: [], // 临时自定义表情列表

  // 初始化编辑器，绑定事件监听器
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
      ?.addEventListener("click", (e) => this.handleDelete(e, "motion"));
    document
      .getElementById("expressionList")
      ?.addEventListener("click", (e) => this.handleDelete(e, "expression"));
  },

  // 渲染动作和表情列表
  renderLists() {
    this.renderList("motion");
    this.renderList("expression");
  },

  // 渲染单个列表（动作或表情）
  renderList(type) {
    const isMotion = type === "motion";
    const manager = isMotion ? motionManager : expressionManager;
    const listContainer = document.getElementById(`${type}List`);
    const tempCustomItems = isMotion
      ? this.tempCustomMotions
      : this.tempCustomExpressions;
    DOMUtils.clearElement(listContainer);
    const allDefaultItems = manager.getAllDefaultItems();
    const allItems = Array.from(
      new Set([...allDefaultItems, ...tempCustomItems])
    ).sort();
    const fragment = document.createDocumentFragment();
    allItems.forEach((item) => {
      const isCustom =
        !allDefaultItems.has(item) && tempCustomItems.includes(item);
      const itemEl = document.createElement("div");
      itemEl.className = "config-list-item";

      if (isCustom) {
        itemEl.classList.add("is-custom");
      }
      const isDeletable = tempCustomItems.includes(item);

      // 使用 createElement 创建元素，避免字符串拼接
      const nameSpan = DOMUtils.createElement("span", {
        class: "item-name",
      });
      nameSpan.textContent = item;
      itemEl.appendChild(nameSpan);

      // 如果可删除，添加删除按钮
      if (isDeletable) {
        const removeBtn = DOMUtils.createElement("button", {
          className: "btn-icon-action btn-icon-danger remove-btn",
          "data-id": item,
          title: "删除此项",
        });
        const icon = DOMUtils.createElement(
          "span",
          { className: "material-symbols-outlined" },
          "delete"
        );
        removeBtn.appendChild(icon);
        itemEl.appendChild(removeBtn);
      }

      fragment.appendChild(itemEl);
    });
    listContainer.appendChild(fragment);
  },

  // 添加自定义动作或表情项
  addItem(type) {
    const isMotion = type === "motion";
    const input = document.getElementById(
      isMotion ? "customMotionInput" : "customExpressionInput"
    );
    const manager = isMotion ? motionManager : expressionManager;
    const tempList = isMotion
      ? this.tempCustomMotions
      : this.tempCustomExpressions;
    const trimmedId = input.value.trim();

    if (!trimmedId) {
      ui.showStatus(`${manager.name}ID不能为空！`, "error");
      return;
    }

    const allKnownItems = new Set(manager.getAllKnownItems());
    if (allKnownItems.has(trimmedId) || tempList.includes(trimmedId)) {
      ui.showStatus(`该${manager.name}ID已存在！`, "error");
      return;
    }

    tempList.push(trimmedId);
    input.value = "";
    this.renderList(type);
  },

  // 处理删除自定义项的点击事件
  handleDelete(e, type) {
    const removeBtn = e.target.closest(".remove-btn");
    if (removeBtn) {
      const idToDelete = removeBtn.dataset.id;
      if (type === "motion") {
        this.tempCustomMotions = this.tempCustomMotions.filter(
          (id) => id !== idToDelete
        );
      } else {
        this.tempCustomExpressions = this.tempCustomExpressions.filter(
          (id) => id !== idToDelete
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
        await new Promise((resolve) => setTimeout(resolve, 300));
        ui.showStatus("动作/表情配置已保存！", "success");
      },
      "保存中..."
    );
  },

  // 恢复默认列表（清空自定义项）
  async reset() {
    if (
      confirm(
        "确定要恢复默认列表吗？您在此窗口中添加或删除的所有自定义项都将被丢弃。"
      )
    ) {
      await ui.withButtonLoading(
        "resetMotionExpressionBtn",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          this.tempCustomMotions = [];
          this.tempCustomExpressions = [];
          this.renderLists();
          ui.showStatus("已在编辑器中恢复默认，请点击保存以生效。", "info");
        },
        "恢复中..."
      );
    }
  },
};
