import { ui } from "./uiUtils.js";
import { motionManager, expressionManager } from "./genericConfigManager.js";
import { DOMUtils } from "./utils/DOMUtils.js";

export const motionExpressionEditor = {
  tempCustomMotions: [], // 临时自定义动作列表
  tempCustomExpressions: [], // 临时自定义表情列表

  // 初始化编辑器，绑定事件监听器
  init() {
    document
      .getElementById("openMotionExpressionBtn")
      ?.addEventListener("click", () => this.open());
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
    const modal = document.getElementById("motionExpressionModal");
    const closeBtn = modal?.querySelector(".modal-close");
    closeBtn?.addEventListener("click", () => this.handleCloseAttempt());
  },

  // 打开动作表情编辑器模态框
  async open() {
    await ui.withButtonLoading(
      "openMotionExpressionBtn",
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        this.tempCustomMotions = JSON.parse(
          JSON.stringify(motionManager.customItems)
        );
        this.tempCustomExpressions = JSON.parse(
          JSON.stringify(expressionManager.customItems)
        );
        this.renderLists();
        ui.openModal("motionExpressionModal");
      },
      "加载中..."
    );
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
      let deleteButtonHtml = "";
      if (isDeletable) {
        deleteButtonHtml = `
            <div class="item-actions">
                <button class="remove-btn" data-id="${item}" title="删除此项">&times;</button>
            </div>
        `;
      }
      itemEl.innerHTML = `<span class="item-name">${item}</span> ${deleteButtonHtml}`;
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
    if (e.target.matches(".remove-btn")) {
      const idToDelete = e.target.dataset.id;
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

  // 处理关闭编辑器的尝试（检查未保存的更改）
  handleCloseAttempt() {
    const isDirty =
      JSON.stringify(this.tempCustomMotions) !==
        JSON.stringify(motionManager.customItems) ||
      JSON.stringify(this.tempCustomExpressions) !==
        JSON.stringify(expressionManager.customItems);
    if (isDirty) {
      if (confirm("您有未保存的更改，确定要关闭吗？")) {
        ui.closeModal("motionExpressionModal");
      }
    } else {
      ui.closeModal("motionExpressionModal");
    }
  },
};
