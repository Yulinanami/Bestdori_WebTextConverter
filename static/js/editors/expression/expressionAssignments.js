import { DOMUtils } from "../../utils/DOMUtils.js";
import { editorService } from "../../services/EditorService.js";

// 动作/表情分配相关的渲染与状态操作
export function attachExpressionAssignments(editor) {
  Object.assign(editor, {
    // 显示卡片的表情设置 UI（展开状态栏）
    showExpressionSetupUI(cardElement) {
      const actionId = cardElement.dataset.id;
      const action = editor.projectFileState.actions.find(
        (a) => a.id === actionId
      );
      if (!action) return;

      const footer = cardElement.querySelector(".timeline-item-footer");
      if (!footer) return;

      DOMUtils.clearElement(footer);

      // 布局动作使用与对话卡片相同的分配系统
      if (action.type === "layout") {
        // 初始化initialState
        if (!action.initialState) {
          action.initialState = {};
        }

        // 创建动作分配容器
        const assignmentsContainer = DOMUtils.createElement("div", {
          className: "motion-assignments-container",
        });
        assignmentsContainer.dataset.actionId = action.id;

        // 为布局卡片创建一个分配项（只有一个角色）
        const char = {
          id: action.characterId,
          name:
            action.characterName ||
            editorService.getCharacterNameById(action.characterId),
        };

        if (char.name) {
          // 将 initialState 转换为 motionData 格式
          const motionData = {
            character: char.id,
            motion: action.initialState.motion || "",
            expression: action.initialState.expression || "",
            delay: action.delay || 0,
          };

          const assignmentItem = editor._createAssignmentItem(
            action,
            motionData,
            0,
            true
          );
          assignmentsContainer.appendChild(assignmentItem);
        }

        footer.appendChild(assignmentsContainer);
        return;
      }

      // Talk动作使用新的分配系统
      // 创建动作分配容器（用于显示已添加的分配）
      const assignmentsContainer = DOMUtils.createElement("div", {
        className: "motion-assignments-container",
      });
      assignmentsContainer.dataset.actionId = actionId;

      // 渲染已有的动作/表情分配
      if (action.motions && action.motions.length > 0) {
        action.motions.forEach((motionData, index) => {
          const assignmentItem = editor._createAssignmentItem(
            action,
            motionData,
            index
          );
          assignmentsContainer.appendChild(assignmentItem);
        });
      }

      // 创建角色选择器
      const characterSelector = editor._createCharacterSelector(action);

      // 创建"设置动作/表情"按钮（始终显示）
      const setupButton = DOMUtils.createButton(
        "设置动作/表情",
        "btn btn-secondary btn-sm setup-expressions-btn"
      );
      // 事件处理通过timeline的事件委托完成，不需要在这里绑定

      // 添加到footer
      footer.appendChild(assignmentsContainer);
      footer.appendChild(characterSelector);
      footer.appendChild(setupButton);

      // 默认隐藏角色选择器
      characterSelector.style.display = "none";
    },

    // 创建角色选择器UI
    _createCharacterSelector(action) {
      const template = document.getElementById(
        "motion-character-selector-template"
      );
      const selectorFragment = template.content.cloneNode(true);

      // 将DocumentFragment转换为实际的DOM元素
      const selectorContainer = DOMUtils.createElement("div");
      selectorContainer.appendChild(selectorFragment);
      const selector = selectorContainer.firstElementChild;

      const listContainer = selector.querySelector(".character-selector-list");

      // 根据action类型确定可选择的角色
      let availableCharacters = [];
      if (action.type === "talk") {
        // talk动作：显示所有登场的角色
        availableCharacters = editor._getStagedCharacters();
      } else if (action.type === "layout") {
        // layout动作：只显示该布局涉及的角色
        const char = {
          id: action.characterId,
          name:
            action.characterName ||
            editorService.getCharacterNameById(action.characterId),
        };
        if (char.name) {
          availableCharacters = [char];
        }
      }

      // 创建角色选项
      availableCharacters.forEach((char) => {
        const optionTemplate = document.getElementById(
          "motion-character-option-template"
        );
        const option = optionTemplate.content.cloneNode(true);
        const optionElement = option.querySelector(".character-selector-item");

        optionElement.dataset.characterId = char.id;
        optionElement.dataset.characterName = char.name;

        const avatarDiv = option.querySelector(".dialogue-avatar");
        editorService.updateCharacterAvatar(
          { querySelector: () => avatarDiv },
          char.id,
          char.name
        );

        option.querySelector(".character-name").textContent = char.name;

        // 事件处理通过timeline的事件委托完成，不需要在这里绑定

        listContainer.appendChild(option);
      });

      return selector;
    },

    // 添加新的动作/表情分配
    _addMotionAssignment(action, character) {
      editor._executeCommand((currentState) => {
        const currentAction = currentState.actions.find(
          (a) => a.id === action.id
        );
        if (!currentAction) return;

        // 确保motions数组存在
        if (!currentAction.motions) {
          currentAction.motions = [];
        }

        // 添加新的分配
        currentAction.motions.push({
          character: character.id,
          motion: "",
          expression: "",
          delay: 0,
        });
      });
      // executeCommand 会自动触发全局渲染，不需要手动追加 DOM
    },

    // 创建单个动作/表情分配项UI
    _createAssignmentItem(action, motionData, index, isLayoutCard = false) {
      const template = document.getElementById(
        "motion-assignment-item-template"
      );
      const itemFragment = template.content.cloneNode(true);

      // 将DocumentFragment转换为实际的DOM元素
      const itemContainer = DOMUtils.createElement("div");
      itemContainer.appendChild(itemFragment);
      const itemElement = itemContainer.firstElementChild;

      // 获取角色信息
      const characterName = editorService.getCharacterNameById(
        motionData.character
      );

      itemElement.dataset.characterId = motionData.character;
      itemElement.dataset.characterName = characterName;
      itemElement.dataset.assignmentIndex = index;
      itemElement.dataset.actionId = action.id;

      // 如果是布局卡片，隐藏删除按钮
      if (isLayoutCard) {
        const removeBtn = itemElement.querySelector(".assignment-remove-btn");
        if (removeBtn) {
          DOMUtils.toggleDisplay(removeBtn, false);
        }
      }

      // 设置角色头像和名称
      const avatarDiv = itemElement.querySelector(".dialogue-avatar");
      editorService.updateCharacterAvatar(
        { querySelector: () => avatarDiv },
        motionData.character,
        characterName
      );
      itemElement.querySelector(".character-name").textContent = characterName;

      // 设置拖放区的值
      const motionValue = itemElement.querySelector(
        ".motion-drop-zone .drop-zone-value"
      );
      const motionClearBtn = itemElement.querySelector(
        ".motion-drop-zone .clear-state-btn"
      );
      motionValue.textContent = motionData.motion || "--";
      if (motionClearBtn) {
        DOMUtils.toggleDisplay(motionClearBtn, !!motionData.motion);
      }

      const expressionValue = itemElement.querySelector(
        ".expression-drop-zone .drop-zone-value"
      );
      const expressionClearBtn = itemElement.querySelector(
        ".expression-drop-zone .clear-state-btn"
      );
      expressionValue.textContent = motionData.expression || "--";
      if (expressionClearBtn) {
        DOMUtils.toggleDisplay(expressionClearBtn, !!motionData.expression);
      }

      // 设置延时值
      const delayInput = itemElement.querySelector(".assignment-delay-input");
      delayInput.value = motionData.delay || 0;

      // 初始化拖放区
      editor._initSortableForAssignmentZones(itemElement, isLayoutCard);

      // 事件处理通过timeline的事件委托完成，不需要在这里绑定

      return itemElement;
    },

    // 为动作/表情分配项的拖放区初始化 Sortable
    _initSortableForAssignmentZones(assignmentElement, isLayoutCard = false) {
      assignmentElement.querySelectorAll(".drop-zone").forEach((zone) => {
        new Sortable(zone, {
          group: {
            name: zone.dataset.type,
            put: function (_to, _from, dragEl) {
              return dragEl.classList.contains("draggable-item");
            },
          },
          animation: 150,

          onAdd: (evt) => {
            const value = evt.item ? evt.item.textContent.trim() : null;
            const dropZone = evt.to;
            const assignmentItem = dropZone.closest(".motion-assignment-item");

            // 立即移除拖拽的元素
            evt.item.remove();

            if (value && assignmentItem) {
              const actionId = assignmentItem.dataset.actionId;
              const assignmentIndex = parseInt(
                assignmentItem.dataset.assignmentIndex
              );
              const type = dropZone.dataset.type;

              // 先立即更新UI显示
              const valueElement = dropZone.querySelector(".drop-zone-value");
              if (valueElement) {
                valueElement.textContent = value;
              }

              const clearBtn = dropZone.querySelector(".clear-state-btn");
              if (clearBtn) {
                DOMUtils.toggleDisplay(clearBtn, true);
              }

              // 然后更新数据
              const updates = {};
              updates[type] = value;

              if (isLayoutCard) {
                // 布局卡片：更新 initialState
                editor._updateLayoutInitialState(actionId, updates);
              } else {
                // 对话卡片：更新 motions 数组
                editor._updateMotionAssignment(
                  actionId,
                  assignmentIndex,
                  updates
                );
              }
            }
          },
        });
      });
    },

    // 更新布局卡片的 initialState
    _updateLayoutInitialState(actionId, updates) {
      editor._executeCommand((currentState) => {
        const action = currentState.actions.find((a) => a.id === actionId);
        if (!action || action.type !== "layout") return;

        if (!action.initialState) {
          action.initialState = {};
        }

        Object.assign(action.initialState, updates);
      });
    },

    // 更新动作/表情分配
    _updateMotionAssignment(actionId, assignmentIndex, updates) {
      editor._executeCommand((currentState) => {
        const action = currentState.actions.find((a) => a.id === actionId);
        if (!action || !action.motions || !action.motions[assignmentIndex])
          return;

        Object.assign(action.motions[assignmentIndex], updates);
      });
    },

    // 删除动作/表情分配
    _removeMotionAssignment(actionId, assignmentIndex) {
      editor._executeCommand((currentState) => {
        const action = currentState.actions.find((a) => a.id === actionId);
        if (!action || !action.motions) return;

        action.motions.splice(assignmentIndex, 1);
      });
      // executeCommand 会自动触发全局渲染，重新生成所有分配项并更新索引
    },

    // 检查动作是否包含表情数据（motions 数组或 initialState）
    _actionHasExpressionData(action) {
      if (action.type === "talk") {
        return action.motions && action.motions.length > 0;
      }

      if (action.type === "layout") {
        return (
          action.initialState && Object.keys(action.initialState).length > 0
        );
      }
      return false;
    },

    /**
     * 获取当前在场的角色列表（根据 layout 动作的 appear 事件）
     * @returns {Array<{id: number, name: string}>} 在场角色列表
     */
    _getStagedCharacters() {
      const appearedCharacterNames = new Set();
      const characters = [];

      if (editor.projectFileState && editor.projectFileState.actions) {
        editor.projectFileState.actions.forEach((action) => {
          if (action.type === "layout" && action.layoutType === "appear") {
            const charName =
              action.characterName ||
              editorService.getCharacterNameById(action.characterId);
            if (charName && !appearedCharacterNames.has(charName)) {
              appearedCharacterNames.add(charName);
              characters.push({
                id: action.characterId,
                name: charName,
              });
            }
          }
        });
      }
      return characters;
    },
  });
}
