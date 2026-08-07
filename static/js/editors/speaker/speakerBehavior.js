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
function handleLayoutDelete(actions, actionId, deps) {
  const layoutAction = deps.findActionById(actionId);
  const deleteIndex = deps.findActionIndexById(actionId);
  if (deleteIndex > -1) {
    markCardMutation(actions, {
      type: "delete",
      actionId,
      startIndex: deleteIndex,
      detail: `type=layout, character=${
        layoutAction?.characterName || layoutAction?.characterId || "?"
      }, layoutType=${layoutAction?.layoutType || "unknown"}`,
    });
  }
  deps.deleteLayoutAction(actionId);
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

// 给编辑器加上对话交互（组合工厂模式）
export function createSpeakerActions(deps) {
  const {
    getDomCache,
    executeCommand,
    executeActionChange,
    findActionById,
    findActionIndexById,
    markSpeakerChange,
    buildProjectState,
    deleteLayoutAction,
    toggleCustomToPosition,
    toggleSpeakerDrag,
    applySortModeToCards,
    getPendingCardMutation,
    setPendingCardMutation,
    getPendingTextChange,
    setPendingTextChange,
    getProjectFileState,
    updateLayoutField,
  } = deps;

  // 内部状态
  let inlineTextEditor = null;
  let isMultiSelectMode = false;
  let isSortMode = false;
  let isDragOptimized = false;
  let onCardClickFn = null;
  let onSelectionChangeFn = null;
  let onLayoutChangeFn = null;

  const actions = {
    // 状态属性对外暴露
    get inlineTextEditor() { return inlineTextEditor; },
    set inlineTextEditor(val) { inlineTextEditor = val; },

    get isMultiSelectMode() { return isMultiSelectMode; },
    set isMultiSelectMode(val) { isMultiSelectMode = val; },

    get isSortMode() { return isSortMode; },
    set isSortMode(val) { isSortMode = val; },

    get isDragOptimized() { return isDragOptimized; },
    set isDragOptimized(val) { isDragOptimized = val; },

    get pendingCardMutation() { return getPendingCardMutation(); },
    set pendingCardMutation(val) { setPendingCardMutation(val); },

    get pendingTextChange() { return getPendingTextChange(); },
    set pendingTextChange(val) { setPendingTextChange(val); },

    get domCache() { return getDomCache(); },

    // 给一条或多条对话加说话人
    assignSpeaker(actionId, newSpeaker, actionIndex) {
      const canvas = getDomCache().canvas;
      const selectedIds = Array.from(selectionManager.selectedIds);
      const selectedTalkIds = selectedIds.filter((selectedId) =>
        Boolean(
          canvas?.querySelector(
            `.dialogue-item[data-id="${selectedId}"]`
          )
        )
      );
      const targetIds = selectedTalkIds.length > 0 ? selectedTalkIds : [actionId];
      const targetActionIndexMap = new Map();

      if (Number.isInteger(actionIndex)) {
        targetActionIndexMap.set(actionId, actionIndex);
      }

      if (selectedTalkIds.length > 0 && canvas) {
        const selectedCards = canvas.querySelectorAll(
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
      executeCommand((currentState) => {
        const updatedActionIds = [];
        // 有变化时记录局部刷新信息
        const flushSpeakerRender = () => {
          if (updatedActionIds.length > 0) {
            markSpeakerChange(updatedActionIds, "ui", renderDetail);
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

      clearSelection(actions);
    },

    // 从一条对话里删掉一个说话人
    removeSpeaker(actionId, characterIdToRemove) {
      executeActionChange(actionId, (action) => {
        const nextSpeakers = action.speakers.filter(
          (speaker) => speaker.characterId !== characterIdToRemove
        );
        if (nextSpeakers.length !== action.speakers.length) {
          action.speakers = nextSpeakers;
          markSpeakerChange(
            [actionId],
            "ui",
            `remove speakerId=${characterIdToRemove}`
          );
        }
      });
    },

    // 清空一条对话里的所有说话人
    clearActionSpeakers(actionId) {
      executeActionChange(actionId, (action) => {
        if (action && action.speakers.length > 0) {
          action.speakers = [];
          markSpeakerChange([actionId], "ui", "clear speakers");
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
            const defaultState = buildProjectState(rawText);
            // 用默认内容覆盖当前项目
            executeCommand((currentState) => {
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
      getProjectFileState()?.actions?.forEach((action) => {
        if (action?.type !== "talk" || !action.speakers) return;
        action.speakers.forEach((speaker) => {
          if (speaker.name) usedNames.add(speaker.name);
        });
      });
      return usedNames;
    },

    // 按当前模式刷新按钮和样式
    applyModeUIState() {
      const modeBtn = getDomCache().multiSelectBtn;
      if (modeBtn) {
        modeBtn.classList.toggle("active", isMultiSelectMode);
      }
      const textEditBtn = getDomCache().textEditBtn;
      if (textEditBtn) {
        if (!isDragOptimized) {
          textEditBtn.disabled = true;
          textEditBtn.classList.remove("active");
          isSortMode = true; // 强制处于排序模式才能让 SortableJS 老逻辑工作
        } else {
          textEditBtn.disabled = false;
          textEditBtn.classList.toggle("active", isSortMode);
        }
      }
      actions.syncMultiSelectBtn();
      actions.syncSortModeBtn();
      // 编辑模式变成常驻开启
      getDomCache().canvas?.classList.add("text-edit-mode-active");
      
      // 更新拖拽状态
      applySortModeToCards?.();
    },

    // 刷新多选按钮文字
    syncMultiSelectBtn() {
      const toggleButton = getDomCache().multiSelectBtn;
      if (toggleButton) {
        toggleButton.textContent = isMultiSelectMode
          ? "多选: 开"
          : "多选: 关";
      }
    },

    // 刷新排序编辑按钮文字
    syncSortModeBtn() {
      const toggleButton = getDomCache().textEditBtn; // 复用原本的 textEditBtn DOM元素
      if (toggleButton) {
        toggleButton.textContent = isSortMode ? "排序卡片: 开" : "排序卡片: 关";
        toggleButton.title = "开启后不再拖拽出角色头像，而是带着整个卡片调整顺序";
      }
    },

    // 切换多选模式
    toggleMultiSelect() {
      isMultiSelectMode = !isMultiSelectMode;
      storageService.save(
        STORAGE_KEYS.SPEAKER_MULTI_SELECT_MODE,
        isMultiSelectMode
      );
      actions.syncMultiSelectBtn();
      clearSelection(actions);
    },

    // 切换卡片排序模式
    toggleSortMode() {
      isSortMode = !isSortMode;
      storageService.save(
        "speaker_sort_mode",
        isSortMode
      );
      actions.applyModeUIState();
    },

    // 关掉行内编辑框
    closeInlineEditor() {
      if (!inlineTextEditor) {
        return;
      }
      inlineTextEditor.card?.classList.remove("is-inline-editing");
      if (inlineTextEditor.textElement) {
        inlineTextEditor.textElement.style.display = "";
      }
      inlineTextEditor.editorElement?.remove();
      inlineTextEditor = null;
      toggleSpeakerDrag?.(true);
    },

    // 保存行内文字修改
    commitInlineTextEdit(actionId, editedText) {
      const targetAction = findActionById(actionId);
      if (!targetAction) {
        return;
      }

      const oldText = targetAction.text || "";
      const trimmedText = editedText.trim();
      actions.closeInlineEditor();

      // 没变就不用保存
      if (trimmedText === oldText.trim()) {
        return;
      }

      setPendingTextChange({
        actionId,
        text: trimmedText,
        oldText,
        detail: `text: "${shortText(oldText)}" -> "${shortText(trimmedText)}"`,
        source: "ui",
      });
      executeActionChange(actionId, (action) => {
        action.text = trimmedText;
      });
    },

    // 保存新增的行内文字
    commitInlineTextAdd(actionId, editedText) {
      const trimmedText = editedText.trim();
      actions.closeInlineEditor();
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
      markCardMutation(actions, {
        type: "add",
        actionId: newAction.id,
        detail: `type=talk, text="${shortText(trimmedText)}", speakers=0`,
      });
      executeCommand((currentState) => {
        const currentIndex = findActionIndexById(actionId, currentState.actions);
        if (currentIndex > -1) {
          currentState.actions.splice(currentIndex + 1, 0, newAction);
        }
      });
    },

    // 打开行内编辑框
    openInlineTextEditor(actionId, initialText, onSave, mode = "edit") {
      const canvas = getDomCache().canvas;
      const dialogueCard = canvas?.querySelector(
        `.dialogue-item[data-id="${actionId}"]`
      );
      if (!dialogueCard) {
        return;
      }

      if (inlineTextEditor?.actionId === actionId && inlineTextEditor.mode === mode) {
        inlineTextEditor.inputElement?.focus();
        return;
      }

      // 打开前先关掉旧的
      actions.closeInlineEditor();

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

      inlineTextEditor = {
        actionId,
        mode,
        card: dialogueCard,
        textElement: dialogueText,
        editorElement,
        inputElement,
      };
      toggleSpeakerDrag?.(false);

      // 把编辑框自己的点击和快捷键都拦在内部
      // 点编辑框时不要触发卡片点击
      editorElement.addEventListener("click", (clickEvent) => {
        clickEvent.stopPropagation();
      });
      // 点取消时直接关闭
      cancelButton.addEventListener("click", () => {
        actions.closeInlineEditor();
      });
      // 点保存时提交内容
      saveButton.addEventListener("click", () => {
        onSave(inputElement.value);
      });
      // 绑定编辑框快捷键
      inputElement.addEventListener("keydown", (keyboardEvent) => {
        if (keyboardEvent.key === "Escape") {
          keyboardEvent.preventDefault();
          actions.closeInlineEditor();
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
      const targetAction = findActionById(actionId);
      if (!targetAction) {
        return;
      }
      actions.openInlineTextEditor(
        actionId,
        targetAction.text || "",
        (editedText) => actions.commitInlineTextEdit(actionId, editedText),
        "edit"
      );
    },

    // 处理卡片点击
    handleCardClick(clickEvent) {
      if (handleDialogueClick(actions, clickEvent)) {
        return;
      }

      const layoutDeleteButton = clickEvent.target.closest(".layout-remove-btn");
      if (layoutDeleteButton) {
        const actionId = findClosestActionId(layoutDeleteButton, ".layout-item");
        if (actionId) {
          handleLayoutDelete(actions, actionId, deps);
        }
        return;
      }

      const togglePositionButton = clickEvent.target.closest(".toggle-position-btn");
      if (togglePositionButton) {
        const actionId = findClosestActionId(togglePositionButton, ".layout-item");
        if (actionId) {
          // 对话编辑器里的布局卡复用公共的终点展开逻辑
          toggleCustomToPosition(actionId);
        }
        return;
      }

      const itemId = findClosestActionId(clickEvent.target, CARD_SELECTOR);
      if (!itemId) {
        return;
      }

      // 卡片点击要同时兼顾单选 多选和范围选
      updateCardSelection(actions, clickEvent, itemId);
    },

    // 删除一条对话卡片
    async handleCardDelete(actionId) {
      actions.closeInlineEditor();
      const targetAction = findActionById(actionId);
      if (!targetAction) {
        return;
      }

      const confirmed = await modalService.confirm(
        `确定要删除这条对话吗？\n\n"${targetAction.text.substring(0, 50)}..."`
      );
      if (!confirmed) {
        return;
      }

      const deleteIndex = findActionIndexById(actionId);
      if (deleteIndex < 0) {
        return;
      }

      markCardMutation(actions, {
        type: "delete",
        actionId,
        startIndex: deleteIndex,
        detail: `type=talk, text="${shortText(targetAction.text)}", speakers=${
          (targetAction.speakers || []).length
        }`,
      });
      executeCommand((currentState) => {
        const index = findActionIndexById(actionId, currentState.actions);
        if (index > -1) {
          currentState.actions.splice(index, 1);
        }
      });
    },

    // 重新绑定选中相关事件
    reattachSelection() {
      const canvas = getDomCache().canvas;
      if (!canvas) {
        return;
      }

      actions.closeInlineEditor();
      if (onCardClickFn) {
        canvas.removeEventListener("click", onCardClickFn);
      }
      clearSelection(actions);
      onCardClickFn = actions.handleCardClick.bind(actions);
      canvas.addEventListener("click", onCardClickFn);
    },

    // 绑定画布上的事件
    bindCanvasEvents() {
      const canvas = getDomCache().canvas;
      if (!canvas) {
        return;
      }

      actions.reattachSelection();

      if (onSelectionChangeFn) {
        canvas.removeEventListener("selectionchange", onSelectionChangeFn);
      }
      // 统一从 selectionchange 刷新所有卡片高亮
      onSelectionChangeFn = (selectionChangeEvent) => {
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
      canvas.addEventListener("selectionchange", onSelectionChangeFn);

      if (onLayoutChangeFn) {
        canvas.removeEventListener("change", onLayoutChangeFn);
      }
      // 布局输入变化时写回数据
      onLayoutChangeFn = (layoutChangeEvent) => {
        const layoutCard = layoutChangeEvent.target.closest(".layout-item");
        if (layoutCard && layoutChangeEvent.target.matches("select, input")) {
          updateLayoutField(
            layoutCard.dataset.id,
            layoutChangeEvent.target
          );
        }
      };
      canvas.addEventListener("change", onLayoutChangeFn);
    },

    // 打开多说话人弹出框
    openSpeakerPopover(actionId, targetElement) {
      document.querySelectorAll("#speaker-popover").forEach((popoverElement) =>
        popoverElement.remove()
      );

      const action = findActionById(actionId);
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
              actions.removeSpeaker(actionId, speaker.characterId);
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
  };

  return actions;
}
