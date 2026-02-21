import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { editorService } from "@services/EditorService.js";
import { modalService } from "@services/ModalService.js";

// 多选模式、文本编辑、卡片点击逻辑等
export function attachSpeakerControls(editor) {
  Object.assign(editor, {
    // 从本地读取“多选/编辑模式”的开关状态
    loadModePreferences() {
      const savedMultiSelect = storageService.get(
        STORAGE_KEYS.SPEAKER_MULTI_SELECT_MODE,
      );
      const savedTextEdit = storageService.get(
        STORAGE_KEYS.SPEAKER_TEXT_EDIT_MODE,
      );
      this.isMultiSelectMode = savedMultiSelect === true;
      this.isTextEditMode = savedTextEdit === true;
    },

    // 把当前模式状态同步到按钮文字和画布样式上
    applyModeUIState() {
      this._updateMultiSelectButtonUI();
      this._updateTextEditButtonUI();
      this.domCache.canvas?.classList.toggle(
        "text-edit-mode-active",
        this.isTextEditMode,
      );
    },

    // 更新“多选按钮”的显示文字
    _updateMultiSelectButtonUI() {
      const btn = this.domCache.toggleMultiSelectBtn;
      if (btn) {
        btn.textContent = this.isMultiSelectMode ? "多选: 开" : "多选: 关";
      }
    },

    // 更新“编辑按钮”的显示文字
    _updateTextEditButtonUI() {
      const btn = this.domCache.toggleTextEditBtn;
      if (btn) {
        btn.textContent = this.isTextEditMode ? "编辑: 开" : "编辑: 关";
      }
    },

    // 切换多选模式（并清空当前选择）
    _toggleMultiSelectMode() {
      this.isMultiSelectMode = !this.isMultiSelectMode;
      storageService.set(
        STORAGE_KEYS.SPEAKER_MULTI_SELECT_MODE,
        this.isMultiSelectMode,
      );
      this._updateMultiSelectButtonUI();
      editorService.clearSelection();
      this.domCache.canvas?.dispatchEvent(
        new CustomEvent("selectionchange", { detail: { selectedIds: [] } }),
      );
    },

    // 切换文本编辑模式（允许直接编辑卡片文本）
    _toggleTextEditMode() {
      this.isTextEditMode = !this.isTextEditMode;
      storageService.set(
        STORAGE_KEYS.SPEAKER_TEXT_EDIT_MODE,
        this.isTextEditMode,
      );
      this.applyModeUIState();
    },

    // 点击“编辑”按钮：弹窗修改这条对话的文本
    _handleTextEdit(actionId) {
      const action = this.projectFileState.actions.find(
        (a) => a.id === actionId,
      );
      if (!action) return;
      const newText = prompt("编辑对话内容:", action.text);

      if (newText !== null && newText.trim() !== action.text.trim()) {
        const trimmedText = newText.trim();
        this._executeCommand((currentState) => {
          const actionToUpdate = currentState.actions.find(
            (a) => a.id === actionId,
          );

          if (actionToUpdate) {
            actionToUpdate.text = trimmedText;
          }
        });
      }
    },

    // 点击卡片时：根据多选/快捷键决定如何选择、或触发编辑/新增/删除
    _handleCardClick(e) {
      const editBtn = e.target.closest(".edit-text-btn");
      if (editBtn) {
        e.stopPropagation();
        const card = editBtn.closest(".dialogue-item");
        if (card && card.dataset.id) this._handleTextEdit(card.dataset.id);
        return;
      }

      const addBtn = e.target.closest(".add-text-btn");
      if (addBtn) {
        e.stopPropagation();
        const card = addBtn.closest(".dialogue-item");
        if (card && card.dataset.id) this._handleCardAdd(card.dataset.id);
        return;
      }

      const deleteBtn = e.target.closest(".delete-text-btn");
      if (deleteBtn) {
        e.stopPropagation();
        const card = deleteBtn.closest(".dialogue-item");
        if (card && card.dataset.id) this._handleCardDelete(card.dataset.id);
        return;
      }

      const deleteButton = e.target.closest(".layout-remove-btn");
      if (deleteButton) {
        const layoutCard = deleteButton.closest(".layout-item");
        if (layoutCard && layoutCard.dataset.id) {
          this._deleteLayoutAction(layoutCard.dataset.id);
          return;
        }
      }
      const item = e.target.closest(".dialogue-item, .layout-item");
      if (!item || !item.dataset.id) return;
      const id = item.dataset.id;

      if (this.isMultiSelectMode) {
        editorService.selectionManager.toggle(id);
      } else {
        if (e.ctrlKey || e.metaKey) {
          editorService.selectionManager.toggle(id);
        } else if (e.shiftKey) {
          editorService.selectionManager.selectRange(
            id,
            this.domCache.canvas,
            ".dialogue-item, .layout-item",
          );
        } else {
          const isAlreadyOnlySelected =
            editorService.selectionManager.selectedIds.has(id) &&
            editorService.selectionManager.selectedIds.size === 1;
          if (isAlreadyOnlySelected) {
            editorService.selectionManager.clear();
          } else {
            editorService.selectionManager.selectSingle(id);
          }
        }
      }

      editorService.selectionManager.lastSelectedId =
        editorService.selectionManager.selectedIds.has(id) ? id : null;
      this.domCache.canvas?.dispatchEvent(
        new CustomEvent("selectionchange", {
          detail: {
            selectedIds: editorService.selectionManager.getSelectedIds(),
          },
        }),
      );
    },

    // 删除一条对话卡片（会二次确认）
    async _handleCardDelete(actionId) {
      const action = this.projectFileState.actions.find(
        (a) => a.id === actionId,
      );
      if (!action) return;

      const confirmed = await modalService.confirm(
        `确定要删除这条对话吗？\n\n"${action.text.substring(0, 50)}..."`,
      );
      if (confirmed) {
        this._executeCommand((currentState) => {
          const index = currentState.actions.findIndex(
            (a) => a.id === actionId,
          );
          if (index > -1) {
            currentState.actions.splice(index, 1);
          }
        });
      }
    },

    // 在当前卡片下方新增一条对话（弹窗输入文本）
    async _handleCardAdd(actionId) {
      const newText = await modalService.prompt("请输入新对话的内容：");
      if (newText && newText.trim()) {
        const trimmedText = newText.trim();
        this._executeCommand((currentState) => {
          const currentIndex = currentState.actions.findIndex(
            (a) => a.id === actionId,
          );
          if (currentIndex > -1) {
            const newAction = {
              id: `action-id-${Date.now()}-${Math.random()}`,
              type: "talk",
              text: trimmedText,
              speakers: [],
            };
            currentState.actions.splice(currentIndex + 1, 0, newAction);
          }
        });
      }
    },

    // 重新绑定画布点击事件（避免重复绑定/旧 handler 残留）
    _reattachSelection() {
      const canvas = this.domCache.canvas;
      if (canvas) {
        if (this._boundCardClickHandler) {
          canvas.removeEventListener("click", this._boundCardClickHandler);
        }
        editorService.clearSelection();
        if (!this._boundCardClickHandler) {
          this._boundCardClickHandler = this._handleCardClick.bind(this);
        }
        canvas.addEventListener("click", this._boundCardClickHandler);
      }
    },

    // 绑定画布：选择高亮、布局控件变更等交互
    bindCanvasEvents() {
      const canvas = this.domCache.canvas;
      if (!canvas) return;

      this._reattachSelection();

      if (this._selectionChangeHandler) {
        canvas.removeEventListener(
          "selectionchange",
          this._selectionChangeHandler,
        );
      }
      this._selectionChangeHandler = (e) => {
        if (!e.detail) return;

        const selectedIds = new Set(e.detail.selectedIds);
        const allCards = canvas.querySelectorAll(
          ".dialogue-item, .layout-item",
        );
        allCards.forEach((card) => {
          if (selectedIds.has(card.dataset.id)) {
            card.classList.add("is-selected");
          } else {
            card.classList.remove("is-selected");
          }
        });
      };
      canvas.addEventListener("selectionchange", this._selectionChangeHandler);

      if (this._layoutChangeHandler) {
        canvas.removeEventListener("change", this._layoutChangeHandler);
      }
      this._layoutChangeHandler = (e) => {
        const card = e.target.closest(".layout-item");
        if (card && e.target.matches("select, input")) {
          this._updateLayoutActionProperty(card.dataset.id, e.target);
        }
      };
      canvas.addEventListener("change", this._layoutChangeHandler);
    },
  });
}
