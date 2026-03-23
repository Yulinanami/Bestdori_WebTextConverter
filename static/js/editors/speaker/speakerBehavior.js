// 对话编辑器里的交互
import { ui } from "@utils/uiUtils.js";
import { DOMUtils } from "@utils/DOMUtils.js";
import { selectionManager } from "@managers/selectionManager.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { modalService } from "@services/ModalService.js";
import { bindOutsideClickDismiss } from "@editors/common/editorCore.js";

// 把长文本压短一点
const CARD_SELECTOR = ".dialogue-item, .layout-item";

// 把文字缩短后再显示
function shortText(text, maxLength = 36) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

// 通知选中状态变了
function emitSelectionChange(editor) {
  editor.domCache.canvas?.dispatchEvent(
    new CustomEvent("selectionchange", {
      detail: {
        selectedIds: Array.from(selectionManager.selectedIds),
      },
    })
  );
}

// 清空当前选中
function clearSelection(editor) {
  selectionManager.selectedIds.clear();
  emitSelectionChange(editor);
}

// 记录卡片增删的局部刷新信息
function markCardMutation(editor, mutation) {
  editor.pendingCardMutation = { source: "ui", ...mutation };
}

// 找到最近的动作 id
function findClosestActionId(target, selector) {
  return target.closest(selector)?.dataset.id;
}

// 更新卡片选中状态
function updateCardSelection(editor, clickEvent, itemId) {
  if (editor.isMultiSelectMode || clickEvent.ctrlKey || clickEvent.metaKey) {
    selectionManager.toggle(itemId);
  } else if (clickEvent.shiftKey) {
    selectionManager.selectRange(
      itemId,
      editor.domCache.canvas,
      CARD_SELECTOR
    );
  } else if (
    selectionManager.selectedIds.has(itemId) &&
    selectionManager.selectedIds.size === 1
  ) {
    selectionManager.selectedIds.clear();
  } else {
    selectionManager.selectSingle(itemId);
  }

  selectionManager.lastSelectedId = selectionManager.selectedIds.has(itemId)
    ? itemId
    : null;
  emitSelectionChange(editor);
}

// 处理对话卡片上的按钮点击
function handleDialogueClick(editor, clickEvent) {
  const actions = [
    [".edit-text-btn", (actionId) => editor.handleTextEdit(actionId)],
    [
      ".add-text-btn",
      (actionId) =>
        editor.openInlineTextEditor(
          actionId,
          "",
          (editedText) => editor.commitInlineTextAdd(actionId, editedText),
          "add"
        ),
    ],
    [".delete-text-btn", (actionId) => editor.handleCardDelete(actionId)],
  ];

  for (const [selector, handler] of actions) {
    const actionTrigger = clickEvent.target.closest(selector);
    if (!actionTrigger) continue;
    clickEvent.stopPropagation();
    const actionId = findClosestActionId(actionTrigger, ".dialogue-item");
    if (actionId) handler(actionId);
    return true;
  }

  return false;
}

// 处理布局卡片删除
function handleLayoutDelete(editor, actionId) {
  const layoutAction = editor.findActionById(actionId);
  const deleteIndex = editor.findActionIndexById(actionId);
  if (deleteIndex > -1) {
    markCardMutation(editor, {
      type: "delete",
      actionId,
      startIndex: deleteIndex,
      detail: `type=layout, character=${
        layoutAction?.characterName || layoutAction?.characterId || "?"
      }, layoutType=${layoutAction?.layoutType || "unknown"}`,
    });
  }
  editor.deleteLayoutAction(actionId);
}

// 创建行内文本编辑框
function createInlineEditor(initialText = "") {
  const inputElement = DOMUtils.createElement("textarea", { className: "form-input dialogue-inline-input" });
  inputElement.value = initialText;
  const cancelButton = DOMUtils.createButton("取消", "btn btn-secondary btn-sm"), saveButton = DOMUtils.createButton("保存", "btn btn-primary btn-sm");
  const editorElement = DOMUtils.createElement("div", { className: "dialogue-inline-editor" }, [
    inputElement,
    DOMUtils.createElement("div", { className: "dialogue-inline-actions" }, [cancelButton, saveButton]),
  ]);

  return { editorElement, inputElement, cancelButton, saveButton };
}

// 给编辑器加上对话交互
export function attachSpeakerActions(editor) {
  Object.assign(editor, {
    inlineTextEditor: null,

    // 给一条或多条对话加说话人
    assignSpeaker(actionId, newSpeaker, actionIndex) {
      const selectedIds = Array.from(selectionManager.selectedIds);
      const selectedTalkIds = selectedIds.filter((selectedId) =>
        Boolean(
          this.domCache.canvas?.querySelector(
            `.dialogue-item[data-id="${selectedId}"]`
          )
        )
      );
      const targetIds = selectedTalkIds.length > 0 ? selectedTalkIds : [actionId];
      const targetActionIndexMap = new Map();

      if (Number.isInteger(actionIndex)) {
        targetActionIndexMap.set(actionId, actionIndex);
      }

      if (selectedTalkIds.length > 0 && this.domCache.canvas) {
        const selectedCards = this.domCache.canvas.querySelectorAll(
          ".dialogue-item.is-selected"
        );
        selectedCards.forEach((cardElement) => {
          const targetActionId = cardElement.dataset.id;
          const targetActionIndex = Number.parseInt(
            cardElement.dataset.actionIndex,
            10
          );
          if (targetActionId && Number.isInteger(targetActionIndex)) {
            targetActionIndexMap.set(targetActionId, targetActionIndex);
          }
        });
      }

      const renderDetail = `add speaker=${newSpeaker.name}(ID:${newSpeaker.characterId})`;
      this.executeCommand((currentState) => {
        const updatedActionIds = [];
        // 有变化时记录局部刷新信息
        const flushSpeakerRender = () => {
          if (updatedActionIds.length > 0) {
            this.markSpeakerChange(updatedActionIds, "ui", renderDetail);
          }
        };
        // 需要时把说话人加进去
        const addSpeakerIfNeeded = (actionToUpdate) => {
          if (!actionToUpdate || actionToUpdate.type !== "talk") {
            return;
          }
          if (!Array.isArray(actionToUpdate.speakers)) {
            actionToUpdate.speakers = [];
          }
          const speakerExists = actionToUpdate.speakers.some(
            (speaker) => speaker.characterId === newSpeaker.characterId
          );
          if (!speakerExists) {
            actionToUpdate.speakers.push(newSpeaker);
            updatedActionIds.push(actionToUpdate.id);
          }
        };

        // 先优先处理当前卡片和当前已选卡片 再回退到按 id 补找
        if (selectedTalkIds.length === 0 && Number.isInteger(actionIndex)) {
          // 只改当前这一条
          const actionToUpdate = currentState.actions[actionIndex];
          if (actionToUpdate && actionToUpdate.id === actionId) {
            addSpeakerIfNeeded(actionToUpdate);
          }
          flushSpeakerRender();
          return;
        }

        const unresolvedTargetIds = [];
        targetIds.forEach((targetActionId) => {
          const targetActionIndex = targetActionIndexMap.get(targetActionId);
          if (Number.isInteger(targetActionIndex)) {
            const actionToUpdate = currentState.actions[targetActionIndex];
            if (actionToUpdate && actionToUpdate.id === targetActionId) {
              addSpeakerIfNeeded(actionToUpdate);
              return;
            }
          }
          unresolvedTargetIds.push(targetActionId);
        });

        if (unresolvedTargetIds.length === 0) {
          flushSpeakerRender();
          return;
        }

        const actionMap = new Map(
          currentState.actions.map((actionItem) => [actionItem.id, actionItem])
        );
        unresolvedTargetIds.forEach((targetActionId) => {
          const actionToUpdate = actionMap.get(targetActionId);
          if (actionToUpdate) {
            addSpeakerIfNeeded(actionToUpdate);
          }
        });

        flushSpeakerRender();
      });

      clearSelection(this);
    },

    // 从一条对话里删掉一个说话人
    removeSpeaker(actionId, characterIdToRemove) {
      this.executeActionChange(actionId, (action) => {
        const nextSpeakers = action.speakers.filter(
          (speaker) => speaker.characterId !== characterIdToRemove
        );
        if (nextSpeakers.length !== action.speakers.length) {
          action.speakers = nextSpeakers;
          this.markSpeakerChange(
            [actionId],
            "ui",
            `remove speakerId=${characterIdToRemove}`
          );
        }
      });
    },

    // 清空一条对话里的所有说话人
    clearActionSpeakers(actionId) {
      this.executeActionChange(actionId, (action) => {
        if (action && action.speakers.length > 0) {
          action.speakers = [];
          this.markSpeakerChange([actionId], "ui", "clear speakers");
        }
      });
    },

    // 恢复默认说话人
    async reset() {
      if (!confirm("确定要恢复默认说话人吗？此操作可以撤销。")) return;

      try {
        await ui.withButtonLoading(
          "resetSpeakersBtn",
          async () => {
            const rawText = document.getElementById("inputText").value;
            const defaultState = this.buildProjectState(rawText);
            // 用默认内容覆盖当前项目
            this.executeCommand((currentState) => {
              Object.assign(currentState, defaultState);
            });
            ui.showStatus("已恢复默认说话人。", "success");
          },
          "恢复中..."
        );
      } catch (error) {
        ui.showStatus(`恢复失败: ${error.message}`, "error");
      }
    },

    // 读取当前项目里用到的角色
    listUsedIds() {
      const usedNames = new Set();
      this.projectFileState?.actions?.forEach((action) => {
        if (action?.type !== "talk" || !action.speakers) return;
        action.speakers.forEach((speaker) => {
          if (speaker.name) usedNames.add(speaker.name);
        });
      });
      return usedNames;
    },

    // 载入持久化的编辑模式
    loadModePreferences() {
      // 读档
      const savedMultiSelect = storageService.load(
        STORAGE_KEYS.SPEAKER_MULTI_SELECT
      );
      this.isMultiSelectMode = savedMultiSelect || false;
      const savedSortMode = storageService.load(
        STORAGE_KEYS.SPEAKER_SORT_MODE
      );
      this.isSortMode = savedSortMode || false;
      
      const savedOptimization = storageService.load(
        STORAGE_KEYS.SPEAKER_DRAG_OPTIMIZATION
      );
      this.isDragOptimized = savedOptimization !== null ? savedOptimization : false;
    },

    // 按当前模式刷新按钮和样式
    applyModeUIState() {
      const modeBtn = this.domCache.multiSelectBtn;
      if (modeBtn) {
        modeBtn.classList.toggle("active", this.isMultiSelectMode);
      }
      const textEditBtn = this.domCache.textEditBtn;
      if (textEditBtn) {
        if (!this.isDragOptimized) {
          textEditBtn.disabled = true;
          textEditBtn.classList.remove("active");
          this.isSortMode = true; // 强制处于排序模式才能让 SortableJS 老逻辑工作
        } else {
          textEditBtn.disabled = false;
          textEditBtn.classList.toggle("active", this.isSortMode);
        }
      }
      this.applySortModeToCards?.();
      this.syncMultiSelectBtn();
      this.syncSortModeBtn();
      // 编辑模式变成常驻开启
      this.domCache.canvas?.classList.add("text-edit-mode-active");
      
      // 更新拖拽状态
      this.applySortModeToCards?.();
    },

    // 刷新多选按钮文字
    syncMultiSelectBtn() {
      const toggleButton = this.domCache.multiSelectBtn;
      if (toggleButton) {
        toggleButton.textContent = this.isMultiSelectMode
          ? "多选: 开"
          : "多选: 关";
      }
    },

    // 刷新排序编辑按钮文字
    syncSortModeBtn() {
      const toggleButton = this.domCache.textEditBtn; // 复用原本的 textEditBtn DOM元素
      if (toggleButton) {
        toggleButton.textContent = this.isSortMode ? "排序卡片: 开" : "排序卡片: 关";
        toggleButton.title = "开启后不再拖拽出角色头像，而是带着整个卡片调整顺序";
      }
    },

    // 切换多选模式
    toggleMultiSelect() {
      this.isMultiSelectMode = !this.isMultiSelectMode;
      storageService.save(
        STORAGE_KEYS.SPEAKER_MULTI_SELECT_MODE,
        this.isMultiSelectMode
      );
      this.syncMultiSelectBtn();
      clearSelection(this);
    },

    // 切换卡片排序模式
    toggleSortMode() {
      this.isSortMode = !this.isSortMode;
      storageService.save(
        "speaker_sort_mode",
        this.isSortMode
      );
      this.applyModeUIState();
    },

    // 关掉行内编辑框
    closeInlineEditor() {
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
      this.toggleSpeakerDrag?.(true);
    },

    // 保存行内文字修改
    commitInlineTextEdit(actionId, editedText) {
      const targetAction = this.findActionById(actionId);
      if (!targetAction) {
        return;
      }

      const oldText = targetAction.text || "";
      const trimmedText = editedText.trim();
      this.closeInlineEditor();

      // 没变就不用保存
      if (trimmedText === oldText.trim()) {
        return;
      }

      this.pendingTextChange = {
        actionId,
        text: trimmedText,
        oldText,
        detail: `text: "${shortText(oldText)}" -> "${shortText(trimmedText)}"`,
        source: "ui",
      };
      this.executeActionChange(actionId, (action) => {
        action.text = trimmedText;
      });
    },

    // 保存新增的行内文字
    commitInlineTextAdd(actionId, editedText) {
      const trimmedText = editedText.trim();
      this.closeInlineEditor();
      if (!trimmedText) {
        return;
      }

      const newAction = {
        id: `action-id-${Date.now()}-${Math.random()}`,
        type: "talk",
        text: trimmedText,
        speakers: [],
      };
      // 先标记局部新增
      markCardMutation(this, {
        type: "add",
        actionId: newAction.id,
        detail: `type=talk, text="${shortText(trimmedText)}", speakers=0`,
      });
      this.executeCommand((currentState) => {
        const currentIndex = this.findActionIndexById(actionId, currentState.actions);
        if (currentIndex > -1) {
          currentState.actions.splice(currentIndex + 1, 0, newAction);
        }
      });
    },

    // 打开行内编辑框
    openInlineTextEditor(actionId, initialText, onSave, mode = "edit") {
      const dialogueCard = this.domCache.canvas?.querySelector(
        `.dialogue-item[data-id="${actionId}"]`
      );
      if (!dialogueCard) {
        return;
      }

      const currentEditor = this.inlineTextEditor;
      if (currentEditor?.actionId === actionId && currentEditor.mode === mode) {
        currentEditor.inputElement?.focus();
        return;
      }

      // 打开前先关掉旧的
      this.closeInlineEditor();

      const dialogueContent = dialogueCard.querySelector(".dialogue-content");
      const dialogueText = dialogueCard.querySelector(".dialogue-text");
      if (!dialogueContent || !dialogueText) {
        return;
      }

      const { editorElement, inputElement, saveButton, cancelButton } =
        createInlineEditor(initialText || "");

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
      this.toggleSpeakerDrag?.(false);

      // 把编辑框自己的点击和快捷键都拦在内部
      // 点编辑框时不要触发卡片点击
      editorElement.addEventListener("click", (clickEvent) => {
        clickEvent.stopPropagation();
      });
      // 点取消时直接关闭
      cancelButton.addEventListener("click", () => {
        this.closeInlineEditor();
      });
      // 点保存时提交内容
      saveButton.addEventListener("click", () => {
        onSave(inputElement.value);
      });
      // 绑定编辑框快捷键
      inputElement.addEventListener("keydown", (keyboardEvent) => {
        if (keyboardEvent.key === "Escape") {
          keyboardEvent.preventDefault();
          this.closeInlineEditor();
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
        inputElement.value.length
      );
    },

    // 打开当前卡片的文字编辑
    handleTextEdit(actionId) {
      const targetAction = this.findActionById(actionId);
      if (!targetAction) {
        return;
      }
      this.openInlineTextEditor(
        actionId,
        targetAction.text || "",
        (editedText) => this.commitInlineTextEdit(actionId, editedText),
        "edit"
      );
    },

    // 处理卡片点击
    handleCardClick(clickEvent) {
      if (handleDialogueClick(this, clickEvent)) {
        return;
      }

      const layoutDeleteButton = clickEvent.target.closest(".layout-remove-btn");
      if (layoutDeleteButton) {
        const actionId = findClosestActionId(layoutDeleteButton, ".layout-item");
        if (actionId) {
          handleLayoutDelete(this, actionId);
        }
        return;
      }

      const togglePositionButton = clickEvent.target.closest(".toggle-position-btn");
      if (togglePositionButton) {
        const actionId = findClosestActionId(togglePositionButton, ".layout-item");
        if (actionId) {
          // 对话编辑器里的布局卡复用公共的终点展开逻辑
          this.toggleCustomToPosition(actionId);
        }
        return;
      }

      const itemId = findClosestActionId(clickEvent.target, CARD_SELECTOR);
      if (!itemId) {
        return;
      }

      // 卡片点击要同时兼顾单选 多选和范围选
      updateCardSelection(this, clickEvent, itemId);
    },

    // 删除一条对话卡片
    async handleCardDelete(actionId) {
      this.closeInlineEditor();
      const targetAction = this.findActionById(actionId);
      if (!targetAction) {
        return;
      }

      const confirmed = await modalService.confirm(
        `确定要删除这条对话吗？\n\n"${targetAction.text.substring(0, 50)}..."`
      );
      if (!confirmed) {
        return;
      }

      const deleteIndex = this.findActionIndexById(actionId);
      if (deleteIndex < 0) {
        return;
      }

      markCardMutation(this, {
        type: "delete",
        actionId,
        startIndex: deleteIndex,
        detail: `type=talk, text="${shortText(targetAction.text)}", speakers=${
          (targetAction.speakers || []).length
        }`,
      });
      this.executeCommand((currentState) => {
        const index = this.findActionIndexById(actionId, currentState.actions);
        if (index > -1) {
          currentState.actions.splice(index, 1);
        }
      });
    },

    // 重新绑定选中相关事件
    reattachSelection() {
      const canvas = this.domCache.canvas;
      if (!canvas) {
        return;
      }

      this.closeInlineEditor();
      if (this._onCardClick) {
        canvas.removeEventListener("click", this._onCardClick);
      }
      clearSelection(this);
      if (!this._onCardClick) {
        this._onCardClick = this.handleCardClick.bind(this);
      }
      canvas.addEventListener("click", this._onCardClick);
    },

    // 绑定画布上的事件
    bindCanvasEvents() {
      const canvas = this.domCache.canvas;
      if (!canvas) {
        return;
      }

      this.reattachSelection();

      if (this._onSelectionChange) {
        canvas.removeEventListener("selectionchange", this._onSelectionChange);
      }
      // 统一从 selectionchange 刷新所有卡片高亮
      // 选中变化时刷新卡片高亮
      this._onSelectionChange = (selectionChangeEvent) => {
        if (!selectionChangeEvent.detail) {
          return;
        }

        const selectedIds = new Set(selectionChangeEvent.detail.selectedIds);
        const allCards = canvas.querySelectorAll(CARD_SELECTOR);
        allCards.forEach((cardElement) => {
          cardElement.classList.toggle(
            "is-selected",
            selectedIds.has(cardElement.dataset.id)
          );
        });
      };
      canvas.addEventListener("selectionchange", this._onSelectionChange);

      if (this._onLayoutChange) {
        canvas.removeEventListener("change", this._onLayoutChange);
      }
      // 布局输入变化时写回数据
      this._onLayoutChange = (layoutChangeEvent) => {
        const layoutCard = layoutChangeEvent.target.closest(".layout-item");
        if (layoutCard && layoutChangeEvent.target.matches("select, input")) {
          this.updateLayoutField(
            layoutCard.dataset.id,
            layoutChangeEvent.target
          );
        }
      };
      canvas.addEventListener("change", this._onLayoutChange);
    },

    // 打开多说话人弹出框
    openSpeakerPopover(actionId, targetElement) {
      document.querySelectorAll("#speaker-popover").forEach((popoverElement) =>
        popoverElement.remove()
      );

      const action = editor.findActionById(actionId);
      if (!action) {
        return;
      }

      const popover = DOMUtils.createElement("div", {
        id: "speaker-popover",
        className: "speaker-popover-menu",
        style: {
          position: "fixed",
          borderRadius: "8px",
          boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
          zIndex: "10001",
          padding: "8px",
          minWidth: "150px",
        },
      });

      // 弹出框里的每一项都对应当前对话里的一个说话人
      const items = action.speakers.map((speaker) => {
        const nameSpan = DOMUtils.createElement(
          "span",
          { style: { flexGrow: "1" } },
          speaker.name
        );
        const deleteButton = DOMUtils.createElement(
          "button",
          {
            className: "speaker-delete-btn",
            style: {
              borderRadius: "50%",
              width: "22px",
              height: "22px",
              cursor: "pointer",
              marginLeft: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              lineHeight: "1",
            },
            // 点删除时移除当前说话人
            onClick: (clickEvent) => {
              clickEvent.stopPropagation();
              editor.removeSpeaker(actionId, speaker.characterId);
              popover.remove();
            },
          },
          "×"
        );

        return DOMUtils.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              padding: "6px 8px",
              borderRadius: "5px",
            },
          },
          [nameSpan, deleteButton]
        );
      });

      DOMUtils.appendChildren(popover, items);
      document.body.appendChild(popover);

      const rect = targetElement.getBoundingClientRect();
      popover.style.top = `${rect.bottom + 5}px`;
      popover.style.left = `${rect.left}px`;

      // 点到弹出框外面时直接关闭
      bindOutsideClickDismiss(popover, () => {
        popover.remove();
      });
    },
  });
}
