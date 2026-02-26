import { DOMUtils } from "@utils/DOMUtils.js";
import { ui } from "@utils/uiUtils.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { modalService } from "@services/ModalService.js";

// 快速填充：一个小下拉菜单，点一下就把关键词填进搜索框里
export const quickFill = {
  // 刷新两个下拉菜单（动作/表情）
  renderQuickFillDropdowns(editor) {
    quickFill.renderQuickFillDropdown(editor, "motion");
    quickFill.renderQuickFillDropdown(editor, "expression");
  },

  // 渲染一个下拉菜单（包含默认项 + 自定义项 + “自定义添加”按钮）
  renderQuickFillDropdown(editor, type) {
    const dropdownId =
      type === "motion" ? "motionQuickFill" : "expressionQuickFill";
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    DOMUtils.clearElement(dropdown);

    const defaultOptions = new Set(editor.quickFillOptions.default);
    const allOptions = [
      ...new Set([
        ...editor.quickFillOptions.default,
        ...editor.quickFillOptions.custom,
      ]),
    ].sort();

    allOptions.forEach((option) => {
      const optionButton = DOMUtils.createButton(option, "quick-fill-item");
      optionButton.dataset.type = type;
      optionButton.dataset.value = option;

      if (
        editor.quickFillOptions.custom.includes(option) &&
        !defaultOptions.has(option)
      ) {
        const deleteButton = DOMUtils.createElement("button", {
          className: "quick-fill-delete-btn",
          title: "删除此项",
        });
        deleteButton.dataset.value = option;

        const icon = DOMUtils.createElement(
          "span",
          { className: "material-symbols-outlined" },
          "delete"
        );
        deleteButton.appendChild(icon);

        optionButton.appendChild(deleteButton);
      }

      dropdown.appendChild(optionButton);
    });

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

  // 展开/收起某个下拉菜单（并在点到外部时自动关闭）
  toggleQuickFillDropdown(type) {
    const dropdownId =
      type === "motion" ? "motionQuickFill" : "expressionQuickFill";
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    const toggleButton = dropdown.previousElementSibling;
    const isActive = !dropdown.classList.contains("hidden");
    if (isActive) {
      if (toggleButton) toggleButton.classList.remove("active");
    } else {
      if (toggleButton) toggleButton.classList.add("active");
    }

    dropdown.classList.toggle("hidden");
    if (!dropdown.classList.contains("hidden")) {
      setTimeout(() => {
        document.addEventListener(
          "click",
          // 点击下拉区域外部时自动收起。
          function onClickOutside(clickEvent) {
            if (!dropdown.parentElement.contains(clickEvent.target)) {
              dropdown.classList.add("hidden");
              if (toggleButton) toggleButton.classList.remove("active");
              document.removeEventListener("click", onClickOutside);
            }
          },
          { once: true }
        );
      }, 0);
    }
  },

  // 点选某个填充项：把值写入搜索框并触发过滤
  handleQuickFillSelect(type, value) {
    const inputId =
      type === "motion" ? "motionSearchInput" : "expressionSearchInput";
    const searchInput = document.getElementById(inputId);
    if (searchInput) {
      searchInput.value = value;
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.focus();
    }
    quickFill.toggleQuickFillDropdown(type);
  },

  // 新增一个自定义填充项（保存到 localStorage）
  async addCustomQuickFillOption(editor) {
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
        quickFill.renderQuickFillDropdowns(editor);
        ui.showStatus(`已添加自定义填充项: ${trimmedValue}`, "success");
      } else {
        ui.showStatus("该填充项已存在！", "error");
      }
    }
  },

  // 删除一个自定义填充项（保存到 localStorage）
  async deleteCustomQuickFillOption(editor, valueToDelete) {
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
      quickFill.renderQuickFillDropdowns(editor);
      ui.showStatus(`已删除填充项: ${valueToDelete}`, "success");
    }
  },
};
