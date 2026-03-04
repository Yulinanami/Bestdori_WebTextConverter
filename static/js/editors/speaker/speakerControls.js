import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { editorService } from "@services/EditorService.js";
import { modalService } from "@services/ModalService.js";

// 压缩文本用于日志，避免控制台输出过长。
function shortText(text, maxLength = 36) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

// 多选模式、文本编辑、卡片点击逻辑等
export function attachSpeakerControls(editor) {
  Object.assign(editor, {
    inlineTextEditor: null,

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
      if (!this.isTextEditMode) {
        this.closeInlineTextEditor();
      }
    },

    // 关闭卡片内文本编辑栏并清理编辑态样式。
    closeInlineTextEditor() {
      const inlineEditor = this.inlineTextEditor;
      if (!inlineEditor) {
        return;
      }
      inlineEditor.card?.classList.remove("is-inline-editing");
      if (inlineEditor.textElement) {
        inlineEditor.textElement.style.display = "";
      }
      inlineEditor.editorElement?.remove();
      this.inlineTextEditor = null;
      this.setSpeakerDragEnabled?.(true);
    },

    // 保存卡片内编辑文本：沿用原 command 链路，保持撤销/局部短路一致。
    commitInlineTextEdit(actionId, editedText) {
      const targetAction = this.projectFileState.actions.find(
        (actionItem) => actionItem.id === actionId,
      );
      if (!targetAction) return;

      const oldText = targetAction.text || "";
      const trimmedText = editedText.trim();
      this.closeInlineTextEditor();

      if (trimmedText === oldText.trim()) {
        return;
      }

      this.pendingTextEditRender = {
        actionId,
        text: trimmedText,
        oldText,
        detail: `text: "${shortText(oldText)}" -> "${shortText(trimmedText)}"`,
        source: "ui",
      };
      this.baseEditor.executeCommand((currentState) => {
        const actionToUpdate = currentState.actions.find(
          (actionItem) => actionItem.id === actionId,
        );
        if (actionToUpdate) {
          actionToUpdate.text = trimmedText;
        }
      });
    },

    // 保存“新增对话”内联编辑文本：保存后在当前卡片下方插入新卡片。
    commitInlineTextAdd(actionId, editedText) {
      const trimmedText = editedText.trim();
      this.closeInlineTextEditor();
      if (!trimmedText) {
        return;
      }

      const newAction = {
        id: `action-id-${Date.now()}-${Math.random()}`,
        type: "talk",
        text: trimmedText,
        speakers: [],
      };
      this.pendingCardMutationRender = {
        type: "add",
        actionId: newAction.id,
        source: "ui",
        detail: `type=talk, text="${shortText(trimmedText)}", speakers=0`,
      };
      this.baseEditor.executeCommand((currentState) => {
        const currentIndex = currentState.actions.findIndex(
          (actionItem) => actionItem.id === actionId,
        );
        if (currentIndex > -1) {
          currentState.actions.splice(currentIndex + 1, 0, newAction);
        }
      });
    },

    // 在指定卡片内打开文本编辑栏，保存逻辑由 onSave 决定（编辑/新增共用）。
    openInlineTextEditor(actionId, initialText, onSave, mode = "edit") {
      const canvas = this.domCache.canvas;
      const dialogueCard = canvas?.querySelector(
        `.dialogue-item[data-id="${actionId}"]`,
      );
      if (!dialogueCard) return;

      const currentEditor = this.inlineTextEditor;
      if (currentEditor?.actionId === actionId && currentEditor.mode === mode) {
        currentEditor.inputElement?.focus();
        return;
      }

      this.closeInlineTextEditor();

      const dialogueContent = dialogueCard.querySelector(".dialogue-content");
      const dialogueText = dialogueCard.querySelector(".dialogue-text");
      if (!dialogueContent || !dialogueText) {
        return;
      }

      const editorElement = document.createElement("div");
      editorElement.className = "dialogue-inline-editor";

      const inputElement = document.createElement("textarea");
      inputElement.className = "form-input dialogue-inline-input";
      inputElement.value = initialText || "";

      const actionsElement = document.createElement("div");
      actionsElement.className = "dialogue-inline-actions";

      const saveButton = document.createElement("button");
      saveButton.className = "btn btn-primary btn-sm";
      saveButton.textContent = "保存";

      const cancelButton = document.createElement("button");
      cancelButton.className = "btn btn-secondary btn-sm";
      cancelButton.textContent = "取消";

      actionsElement.appendChild(cancelButton);
      actionsElement.appendChild(saveButton);
      editorElement.appendChild(inputElement);
      editorElement.appendChild(actionsElement);

      dialogueCard.classList.add("is-inline-editing");
      dialogueText.style.display = "none";
      dialogueContent.appendChild(editorElement);

      this.inlineTextEditor = {
        actionId,
        mode,
        card: dialogueCard,
        textElement: dialogueText,
        editorElement,
        inputElement,
      };
      this.setSpeakerDragEnabled?.(false);

      editorElement.addEventListener("click", (clickEvent) => {
        clickEvent.stopPropagation();
      });
      cancelButton.addEventListener("click", () => {
        this.closeInlineTextEditor();
      });
      saveButton.addEventListener("click", () => {
        onSave(inputElement.value);
      });
      inputElement.addEventListener("keydown", (keyboardEvent) => {
        if (keyboardEvent.key === "Escape") {
          keyboardEvent.preventDefault();
          this.closeInlineTextEditor();
          return;
        }
        if (
          keyboardEvent.key === "Enter" &&
          (keyboardEvent.ctrlKey || keyboardEvent.metaKey)
        ) {
          keyboardEvent.preventDefault();
          onSave(inputElement.value);
        }
      });

      inputElement.focus();
      inputElement.setSelectionRange(
        inputElement.value.length,
        inputElement.value.length,
      );
    },

    // 点击“编辑”按钮：在卡片内打开编辑栏。
    handleTextEdit(actionId) {
      const targetAction = this.projectFileState.actions.find(
        (actionItem) => actionItem.id === actionId,
      );
      if (!targetAction) return;
      this.openInlineTextEditor(
        actionId,
        targetAction.text || "",
        (editedText) => this.commitInlineTextEdit(actionId, editedText),
        "edit",
      );
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
          const layoutAction = this.projectFileState.actions.find(
            (actionItem) => actionItem.id === layoutCard.dataset.id
          );
          const deleteIndex = this.projectFileState.actions.findIndex(
            (actionItem) => actionItem.id === layoutCard.dataset.id
          );
          if (deleteIndex > -1) {
            this.pendingCardMutationRender = {
              type: "delete",
              actionId: layoutCard.dataset.id,
              startIndex: deleteIndex,
              source: "ui",
              detail: `type=layout, character=${
                layoutAction?.characterName || layoutAction?.characterId || "?"
              }, layoutType=${layoutAction?.layoutType || "unknown"}`,
            };
          }
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
      this.closeInlineTextEditor();
      const targetAction = this.projectFileState.actions.find(
        (actionItem) => actionItem.id === actionId,
      );
      if (!targetAction) return;

      const confirmed = await modalService.confirm(
        `确定要删除这条对话吗？\n\n"${targetAction.text.substring(0, 50)}..."`,
      );
      if (confirmed) {
        const deleteIndex = this.projectFileState.actions.findIndex(
          (actionItem) => actionItem.id === actionId,
        );
        if (deleteIndex < 0) return;
        this.pendingCardMutationRender = {
          type: "delete",
          actionId,
          startIndex: deleteIndex,
          source: "ui",
          detail: `type=talk, text="${shortText(
            targetAction.text
          )}", speakers=${(targetAction.speakers || []).length}`,
        };
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

    // 在当前卡片内打开新增编辑栏，保存后插入新对话卡片。
    handleCardAdd(actionId) {
      this.openInlineTextEditor(
        actionId,
        "",
        (editedText) => this.commitInlineTextAdd(actionId, editedText),
        "add",
      );
    },

    // 重新绑定画布点击事件（避免重复绑定/旧 handler 残留）
    reattachSelection() {
      const canvas = this.domCache.canvas;
      if (canvas) {
        this.closeInlineTextEditor();
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
