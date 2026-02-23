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
      this.updateMultiSelectButtonUI();
      this.updateTextEditButtonUI();
      this.domCache.canvas?.classList.toggle(
        "text-edit-mode-active",
        this.isTextEditMode,
      );
    },

    // 更新“多选按钮”的显示文字
    updateMultiSelectButtonUI() {
      const toggleButton = this.domCache.toggleMultiSelectBtn;
      if (toggleButton) {
        toggleButton.textContent = this.isMultiSelectMode
          ? "多选: 开"
          : "多选: 关";
      }
    },

    // 更新“编辑按钮”的显示文字
    updateTextEditButtonUI() {
      const toggleButton = this.domCache.toggleTextEditBtn;
      if (toggleButton) {
        toggleButton.textContent = this.isTextEditMode
          ? "编辑: 开"
          : "编辑: 关";
      }
    },

    // 切换多选模式（并清空当前选择）
    toggleMultiSelectMode() {
      this.isMultiSelectMode = !this.isMultiSelectMode;
      storageService.set(
        STORAGE_KEYS.SPEAKER_MULTI_SELECT_MODE,
        this.isMultiSelectMode,
      );
      this.updateMultiSelectButtonUI();
      editorService.selectionManager.selectedIds.clear();
      this.domCache.canvas?.dispatchEvent(
        new CustomEvent("selectionchange", { detail: { selectedIds: [] } }),
      );
    },

    // 切换文本编辑模式（允许直接编辑卡片文本）
    toggleTextEditMode() {
      this.isTextEditMode = !this.isTextEditMode;
      storageService.set(
        STORAGE_KEYS.SPEAKER_TEXT_EDIT_MODE,
        this.isTextEditMode,
      );
      this.applyModeUIState();
    },

    // 点击“编辑”按钮：弹窗修改这条对话的文本
    handleTextEdit(actionId) {
      const targetAction = this.projectFileState.actions.find(
        (actionItem) => actionItem.id === actionId,
      );
      if (!targetAction) return;
      const editedText = prompt("编辑对话内容:", targetAction.text);

      if (editedText !== null && editedText.trim() !== targetAction.text.trim()) {
        const trimmedText = editedText.trim();
        this.baseEditor.executeCommand((currentState) => {
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
    handleCardClick(clickEvent) {
      const editButton = clickEvent.target.closest(".edit-text-btn");
      if (editButton) {
        clickEvent.stopPropagation();
        const dialogueCard = editButton.closest(".dialogue-item");
        if (dialogueCard && dialogueCard.dataset.id) {
          this.handleTextEdit(dialogueCard.dataset.id);
        }
        return;
      }

      const addButton = clickEvent.target.closest(".add-text-btn");
      if (addButton) {
        clickEvent.stopPropagation();
        const dialogueCard = addButton.closest(".dialogue-item");
        if (dialogueCard && dialogueCard.dataset.id) {
          this.handleCardAdd(dialogueCard.dataset.id);
        }
        return;
      }

      const deleteButton = clickEvent.target.closest(".delete-text-btn");
      if (deleteButton) {
        clickEvent.stopPropagation();
        const dialogueCard = deleteButton.closest(".dialogue-item");
        if (dialogueCard && dialogueCard.dataset.id) {
          this.handleCardDelete(dialogueCard.dataset.id);
        }
        return;
      }

      const layoutDeleteButton = clickEvent.target.closest(".layout-remove-btn");
      if (layoutDeleteButton) {
        const layoutCard = layoutDeleteButton.closest(".layout-item");
        if (layoutCard && layoutCard.dataset.id) {
          this.deleteLayoutAction(layoutCard.dataset.id);
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
            editorService.selectionManager.selectedIds.clear();
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
            selectedIds: Array.from(editorService.selectionManager.selectedIds),
          },
        }),
      );
    },

    // 删除一条对话卡片（会二次确认）
    async handleCardDelete(actionId) {
      const targetAction = this.projectFileState.actions.find(
        (actionItem) => actionItem.id === actionId,
      );
      if (!targetAction) return;

      const confirmed = await modalService.confirm(
        `确定要删除这条对话吗？\n\n"${targetAction.text.substring(0, 50)}..."`,
      );
      if (confirmed) {
        this.baseEditor.executeCommand((currentState) => {
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
    async handleCardAdd(actionId) {
      const newText = await modalService.prompt("请输入新对话的内容：");
      if (newText && newText.trim()) {
        const trimmedText = newText.trim();
        this.baseEditor.executeCommand((currentState) => {
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
    reattachSelection() {
      const canvas = this.domCache.canvas;
      if (canvas) {
        if (this._onCardClick) {
          canvas.removeEventListener("click", this._onCardClick);
        }
        editorService.selectionManager.selectedIds.clear();
        if (!this._onCardClick) {
          this._onCardClick = this.handleCardClick.bind(this);
        }
        canvas.addEventListener("click", this._onCardClick);
      }
    },

    // 绑定画布：选择高亮、布局控件变更等交互
    bindCanvasEvents() {
      const canvas = this.domCache.canvas;
      if (!canvas) return;

      this.reattachSelection();

      if (this._onSelectionChange) {
        canvas.removeEventListener(
          "selectionchange",
          this._onSelectionChange,
        );
      }
      this._onSelectionChange = (selectionChangeEvent) => {
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
      canvas.addEventListener("selectionchange", this._onSelectionChange);

      if (this._onLayoutChange) {
        canvas.removeEventListener("change", this._onLayoutChange);
      }
      this._onLayoutChange = (layoutChangeEvent) => {
        const layoutCard = layoutChangeEvent.target.closest(".layout-item");
        if (layoutCard && layoutChangeEvent.target.matches("select, input")) {
          this.updateLayoutActionProperty(
            layoutCard.dataset.id,
            layoutChangeEvent.target
          );
        }
      };
      canvas.addEventListener("change", this._onLayoutChange);
    },
  });
}
