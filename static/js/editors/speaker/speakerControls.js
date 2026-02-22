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
      const toggleButton = this.domCache.toggleMultiSelectBtn;
      if (toggleButton) {
        toggleButton.textContent = this.isMultiSelectMode
          ? "多选: 开"
          : "多选: 关";
      }
    },

    // 更新“编辑按钮”的显示文字
    _updateTextEditButtonUI() {
      const toggleButton = this.domCache.toggleTextEditBtn;
      if (toggleButton) {
        toggleButton.textContent = this.isTextEditMode
          ? "编辑: 开"
          : "编辑: 关";
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
        (actionItem) => actionItem.id === actionId,
      );
      if (!action) return;
      const newText = prompt("编辑对话内容:", action.text);

      if (newText !== null && newText.trim() !== action.text.trim()) {
        const trimmedText = newText.trim();
        this._executeCommand((currentState) => {
          const actionToUpdate = currentState.actions.find(
            (actionItem) => actionItem.id === actionId,
          );

          if (actionToUpdate) {
            actionToUpdate.text = trimmedText;
          }
        });
      }
    },

    // 点击卡片时：根据多选/快捷键决定如何选择、或触发编辑/新增/删除
    _handleCardClick(clickEvent) {
      const editButton = clickEvent.target.closest(".edit-text-btn");
      if (editButton) {
        clickEvent.stopPropagation();
        const dialogueCard = editButton.closest(".dialogue-item");
        if (dialogueCard && dialogueCard.dataset.id) {
          this._handleTextEdit(dialogueCard.dataset.id);
        }
        return;
      }

      const addButton = clickEvent.target.closest(".add-text-btn");
      if (addButton) {
        clickEvent.stopPropagation();
        const dialogueCard = addButton.closest(".dialogue-item");
        if (dialogueCard && dialogueCard.dataset.id) {
          this._handleCardAdd(dialogueCard.dataset.id);
        }
        return;
      }

      const deleteButton = clickEvent.target.closest(".delete-text-btn");
      if (deleteButton) {
        clickEvent.stopPropagation();
        const dialogueCard = deleteButton.closest(".dialogue-item");
        if (dialogueCard && dialogueCard.dataset.id) {
          this._handleCardDelete(dialogueCard.dataset.id);
        }
        return;
      }

      const layoutDeleteButton = clickEvent.target.closest(".layout-remove-btn");
      if (layoutDeleteButton) {
        const layoutCard = layoutDeleteButton.closest(".layout-item");
        if (layoutCard && layoutCard.dataset.id) {
          this._deleteLayoutAction(layoutCard.dataset.id);
          return;
        }
      }
      const clickedCard = clickEvent.target.closest(".dialogue-item, .layout-item");
      if (!clickedCard || !clickedCard.dataset.id) return;
      const itemId = clickedCard.dataset.id;

      if (this.isMultiSelectMode) {
        editorService.selectionManager.toggle(itemId);
      } else {
        if (clickEvent.ctrlKey || clickEvent.metaKey) {
          editorService.selectionManager.toggle(itemId);
        } else if (clickEvent.shiftKey) {
          editorService.selectionManager.selectRange(
            itemId,
            this.domCache.canvas,
            ".dialogue-item, .layout-item",
          );
        } else {
          const isAlreadyOnlySelected =
            editorService.selectionManager.selectedIds.has(itemId) &&
            editorService.selectionManager.selectedIds.size === 1;
          if (isAlreadyOnlySelected) {
            editorService.selectionManager.clear();
          } else {
            editorService.selectionManager.selectSingle(itemId);
          }
        }
      }

      editorService.selectionManager.lastSelectedId =
        editorService.selectionManager.selectedIds.has(itemId)
          ? itemId
          : null;
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
        (actionItem) => actionItem.id === actionId,
      );
      if (!action) return;

      const confirmed = await modalService.confirm(
        `确定要删除这条对话吗？\n\n"${action.text.substring(0, 50)}..."`,
      );
      if (confirmed) {
        this._executeCommand((currentState) => {
          const index = currentState.actions.findIndex(
            (actionItem) => actionItem.id === actionId,
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
            (actionItem) => actionItem.id === actionId,
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
      this._selectionChangeHandler = (selectionChangeEvent) => {
        if (!selectionChangeEvent.detail) return;

        const selectedIds = new Set(selectionChangeEvent.detail.selectedIds);
        const allCards = canvas.querySelectorAll(
          ".dialogue-item, .layout-item",
        );
        allCards.forEach((cardElement) => {
          if (selectedIds.has(cardElement.dataset.id)) {
            cardElement.classList.add("is-selected");
          } else {
            cardElement.classList.remove("is-selected");
          }
        });
      };
      canvas.addEventListener("selectionchange", this._selectionChangeHandler);

      if (this._layoutChangeHandler) {
        canvas.removeEventListener("change", this._layoutChangeHandler);
      }
      this._layoutChangeHandler = (layoutChangeEvent) => {
        const layoutCard = layoutChangeEvent.target.closest(".layout-item");
        if (layoutCard && layoutChangeEvent.target.matches("select, input")) {
          this._updateLayoutActionProperty(
            layoutCard.dataset.id,
            layoutChangeEvent.target
          );
        }
      };
      canvas.addEventListener("change", this._layoutChangeHandler);
    },
  });
}
