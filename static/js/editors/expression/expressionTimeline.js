import { DOMUtils } from "../../utils/DOMUtils.js";
import { renderGroupedView } from "../../utils/uiUtils.js";
import {
  createTalkCard,
  createLayoutCard,
} from "../../utils/TimelineCardFactory.js";
import { editorService } from "../../services/EditorService.js";

// 时间轴渲染与事件绑定
export function attachExpressionTimeline(editor) {
  Object.assign(editor, {
    bindTimelineEvents() {
      const timeline = editor.domCache.timeline;
      if (!timeline) return;

      timeline.onclick = (e) => {
        const card = e.target.closest(".timeline-item");
        if (!card) return;

        // 处理"设置动作/表情"按钮点击
        if (e.target.matches(".setup-expressions-btn")) {
          const actionId = card.dataset.id;
          const action = editor.projectFileState.actions.find(
            (a) => a.id === actionId
          );

          const footer = card.querySelector(".timeline-item-footer");

          // 布局动作：直接显示拖放区（调用showExpressionSetupUI会处理）
          if (action && action.type === "layout") {
            editor.showExpressionSetupUI(card);
            return;
          }

          // Talk动作：显示/隐藏角色选择器
          const characterSelector = footer?.querySelector(
            ".motion-character-selector"
          );
          if (characterSelector) {
            // 切换角色选择器的显示状态
            const isHidden = characterSelector.style.display === "none";
            characterSelector.style.display = isHidden ? "block" : "none";
          } else {
            // 首次点击，初始化UI并显示选择器
            editor.showExpressionSetupUI(card);
            // 立即显示选择器（只对talk动作）
            const newSelector = footer?.querySelector(
              ".motion-character-selector"
            );
            if (newSelector) {
              newSelector.style.display = "block";
            }
          }
          return;
        }

        // 处理角色选择器中的角色点击
        if (
          e.target.matches(".character-selector-item") ||
          e.target.closest(".character-selector-item")
        ) {
          const characterItem = e.target.closest(".character-selector-item");
          if (characterItem) {
            const characterId = parseInt(characterItem.dataset.characterId);
            const characterName = characterItem.dataset.characterName;
            const actionId = card.dataset.id;
            const action = editor.projectFileState.actions.find(
              (a) => a.id === actionId
            );
            if (action) {
              editor._addMotionAssignment(action, {
                id: characterId,
                name: characterName,
              });
              // 点击后关闭选择器
              const footer = card.querySelector(".timeline-item-footer");
              const characterSelector = footer?.querySelector(
                ".motion-character-selector"
              );
              if (characterSelector) {
                characterSelector.style.display = "none";
              }
            }
          }
          return;
        }

        // 处理删除动作/表情分配按钮
        if (e.target.matches(".assignment-remove-btn")) {
          const assignmentItem = e.target.closest(".motion-assignment-item");
          if (assignmentItem) {
            const assignmentIndex = parseInt(
              assignmentItem.dataset.assignmentIndex
            );
            const actionId = card.dataset.id;
            editor._removeMotionAssignment(actionId, assignmentIndex);
          }
          return;
        }

        if (e.target.matches(".clear-state-btn")) {
          const dropZone = e.target.closest(".drop-zone");

          // 处理动作/表情分配项的清除按钮
          const assignmentItem = e.target.closest(".motion-assignment-item");
          if (assignmentItem && dropZone) {
            const actionId = assignmentItem.dataset.actionId;
            const assignmentIndex = parseInt(
              assignmentItem.dataset.assignmentIndex
            );
            const type = dropZone.dataset.type;

            // 更新UI
            const valueElement = dropZone.querySelector(".drop-zone-value");
            if (valueElement) {
              valueElement.textContent = "--";
            }
            DOMUtils.toggleDisplay(e.target, false);

            // 更新数据：检查是布局卡片还是对话卡片
            const action = editor.projectFileState.actions.find(
              (a) => a.id === actionId
            );
            const updates = {};
            updates[type] = "";

            if (action && action.type === "layout") {
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
            return;
          }
          return;
        }

        if (e.target.matches(".layout-remove-btn")) {
          editor._deleteLayoutAction(card.dataset.id);
          return;
        }
      };

      timeline.onchange = (e) => {
        // 处理动作/表情分配项的延时输入变化
        const assignmentItem = e.target.closest(".motion-assignment-item");
        if (assignmentItem && e.target.matches(".assignment-delay-input")) {
          const actionId = assignmentItem.dataset.actionId;
          const assignmentIndex = parseInt(
            assignmentItem.dataset.assignmentIndex
          );
          const delayValue = parseFloat(e.target.value) || 0;

          // 检查是布局卡片还是对话卡片
          const action = editor.projectFileState.actions.find(
            (a) => a.id === actionId
          );

          if (action && action.type === "layout") {
            // 布局卡片：更新 action.delay
            editor._executeCommand((currentState) => {
              const layoutAction = currentState.actions.find(
                (a) => a.id === actionId
              );
              if (layoutAction) {
                layoutAction.delay = delayValue;
              }
            });
          } else {
            // 对话卡片：更新 motions 数组中的 delay
            editor._updateMotionAssignment(actionId, assignmentIndex, {
              delay: delayValue,
            });
          }
          return;
        }

        // 处理布局卡片的延时输入变化（旧的 layout-delay-input，向后兼容）
        if (e.target.matches(".layout-delay-input")) {
          const actionId = e.target.dataset.actionId;
          const delayValue = parseFloat(e.target.value) || 0;

          editor._executeCommand((currentState) => {
            const action = currentState.actions.find((a) => a.id === actionId);
            if (action) {
              action.delay = delayValue;
            }
          });
          return;
        }

        // 处理布局动作的属性变化
        const card = e.target.closest(".layout-item");
        if (card && e.target.matches("select, input")) {
          editor._updateLayoutActionProperty(card.dataset.id, e.target);
        }
      };
    },

    /**
     * 渲染表情编辑器时间轴
     * 渲染两种类型的卡片:
     * - talk卡片: 显示对话内容,可设置每个登场角色的动作/表情
     * - layout卡片: Live2D布局动作(登场/移动/退场),可编辑位置和服装
     * 支持分组模式(50条/组)和普通模式,自动显示卡片序号和表情设置状态
     */
    renderTimeline() {
      const timeline = editor.domCache.timeline;
      if (!timeline) return;

      const isGroupingEnabled = editor.domCache.groupCheckbox?.checked || false;
      const actions = editor.projectFileState.actions;
      const groupSize = 50;

      // 创建索引缓存 Map
      const actionIndexMap = new Map(
        editor.projectFileState.actions.map((a, idx) => [a.id, idx])
      );

      const renderSingleCard = (action) => {
        const globalIndex = actionIndexMap.get(action.id) ?? -1;
        let card;

        if (action.type === "talk") {
          card = createTalkCard(action);
        } else if (action.type === "layout") {
          card = createLayoutCard(action, {
            renderLayoutControls: (cardEl, layoutAction, characterName) =>
              editor.renderLayoutCardControls(
                cardEl,
                layoutAction,
                characterName,
                {
                  showToggleButton: false,
                }
              ),
          });
        } else {
          return null;
        }
        const numberDiv = card.querySelector(".card-sequence-number");
        if (numberDiv && globalIndex !== -1) {
          numberDiv.textContent = `#${globalIndex + 1}`;
        }

        const footer = card.querySelector(".timeline-item-footer");
        if (editor._actionHasExpressionData(action)) {
          // 对于talk动作，使用新的分配系统渲染
          if (action.type === "talk") {
            // 创建动作分配容器
            const assignmentsContainer = DOMUtils.createElement("div", {
              className: "motion-assignments-container",
            });
            assignmentsContainer.dataset.actionId = action.id;

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
            characterSelector.style.display = "none"; // 默认隐藏

            // 创建"设置动作/表情"按钮
            const setupButton = DOMUtils.createButton(
              "设置动作/表情",
              "btn btn-secondary btn-sm setup-expressions-btn"
            );

            DOMUtils.clearElement(footer);
            footer.appendChild(assignmentsContainer);
            footer.appendChild(characterSelector);
            footer.appendChild(setupButton);
          } else if (action.type === "layout") {
            // layout动作使用与talk相同的分配系统
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
                motion: action.initialState?.motion || "",
                expression: action.initialState?.expression || "",
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

            DOMUtils.clearElement(footer);
            footer.appendChild(assignmentsContainer);
          }
        } else {
          // 没有表情数据时显示"设置动作/表情"按钮
          // 但layout动作点击后会直接显示拖放区而不是按钮
          DOMUtils.clearElement(footer);
          const setupButton = DOMUtils.createButton(
            "设置动作/表情",
            "btn btn-secondary btn-sm setup-expressions-btn"
          );
          footer.appendChild(setupButton);
        }

        return card;
      };

      if (isGroupingEnabled && actions.length > groupSize) {
        renderGroupedView({
          container: timeline,
          actions: actions,
          activeGroupIndex: editor.activeGroupIndex,
          onGroupClick: (index) => {
            const isOpening = editor.activeGroupIndex !== index;
            editor.activeGroupIndex = isOpening ? index : null;
            editor.renderTimeline();

            if (isOpening) {
              setTimeout(() => {
                const scrollContainer = editor.domCache.timeline;
                const header = scrollContainer?.querySelector(
                  `.timeline-group-header[data-group-idx="${index}"]`
                );
                if (scrollContainer && header) {
                  scrollContainer.scrollTo({
                    top: header.offsetTop - 110,
                    behavior: "smooth",
                  });
                }
              }, 0);
            }
          },
          renderItemFn: renderSingleCard,
          groupSize: groupSize,
        });
      } else {
        DOMUtils.clearElement(timeline);
        const fragment = document.createDocumentFragment();
        actions.forEach((action) => {
          const card = renderSingleCard(action);
          if (card) fragment.appendChild(card);
        });
        timeline.appendChild(fragment);
      }
    },
  });
}
