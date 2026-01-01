// 布局卡片的通用属性编辑：当用户改下拉框/输入框时，把改动写回 action 数据

import { DOMUtils } from "@utils/DOMUtils.js";
import { editorService } from "@services/EditorService.js";

export const LayoutPropertyMixin = {
  // 不同控件对应不同字段：这里集中放“控件 class -> 如何更新 action”
  _layoutPropertyHandlers: {
    "layout-type-select": (action, value) => {
      action.layoutType = value;
    },

    "layout-costume-select": (action, value) => {
      action.costume = value;
    },

    "layout-position-select-to": (action, value) => {
      if (!action.position) action.position = {};
      if (!action.position.to) action.position.to = {};
      action.position.to.side = value;
    },

    "layout-offset-input-to": (action, value) => {
      if (!action.position) action.position = {};
      if (!action.position.to) action.position.to = {};
      action.position.to.offsetX = value;
    },

    "layout-position-select": (action, value) => {
      if (!action.position) action.position = {};

      // 未展开时的行为
      if (!action._independentToPosition) {
        // 移动类型：主位置是终点，修改 to，from 保持不变
        if (action.layoutType === "move") {
          if (!action.position.to) action.position.to = {};
          action.position.to.side = value;
        } else {
          // 登场/退场：主位置是起点，同时修改 from 和 to
          if (!action.position.from) action.position.from = {};
          action.position.from.side = value;
          if (!action.position.to) action.position.to = {};
          action.position.to.side = value;
        }
      } else {
        // 展开时：主位置是起点，只修改 from
        if (!action.position.from) action.position.from = {};
        action.position.from.side = value;
      }
    },

    "layout-offset-input": (action, value) => {
      if (!action.position) action.position = {};

      // 未展开时的行为
      if (!action._independentToPosition) {
        // 移动类型：主位置是终点，修改 to，from 保持不变
        if (action.layoutType === "move") {
          if (!action.position.to) action.position.to = {};
          action.position.to.offsetX = value;
        } else {
          // 登场/退场：主位置是起点，同时修改 from 和 to
          if (!action.position.from) action.position.from = {};
          action.position.from.offsetX = value;
          if (!action.position.to) action.position.to = {};
          action.position.to.offsetX = value;
        }
      } else {
        // 展开时：主位置是起点，只修改 from
        if (!action.position.from) action.position.from = {};
        action.position.from.offsetX = value;
      }
    },
  },

  // 根据触发的控件类型，把布局卡片的改动写回 action（按 actionId 找到那条 action）
  _updateLayoutActionProperty(actionId, targetElement) {
    const value =
      targetElement.type === "number"
        ? parseInt(targetElement.value) || 0
        : targetElement.value;
    const controlClassName = targetElement.className;

    this._executeCommand((currentState) => {
      const action = currentState.actions.find((a) => a.id === actionId);
      if (!action) return;

      // 找到匹配的处理器并执行
      const handlerKey = Object.keys(this._layoutPropertyHandlers).find((key) =>
        controlClassName.includes(key)
      );

      if (handlerKey) {
        this._layoutPropertyHandlers[handlerKey](action, value);
      }
    });
  },

  // 把布局卡片上的控件（位置/偏移/服装等）渲染成当前 action 的值
  renderLayoutCardControls(card, action, characterName, options = {}) {
    const { showToggleButton = false } = options;

    // 设置布局类型
    const typeSelect = card.querySelector(".layout-type-select");
    if (typeSelect) {
      typeSelect.value = action.layoutType;
    }

    // 获取位置选择器
    const positionSelect = card.querySelector(".layout-position-select");
    const offsetInput = card.querySelector(".layout-offset-input");

    // 主位置显示逻辑：
    // - 展开时：所有类型都显示起点（from）
    // - 未展开时：移动显示终点（to），登场/退场显示起点（from）
    const isExpanded = action._independentToPosition;
    const isMove = action.layoutType === "move";
    const currentPosition =
      isExpanded || !isMove
        ? action.position?.from?.side || "center"
        : action.position?.to?.side || "center";
    const currentOffset =
      isExpanded || !isMove
        ? action.position?.from?.offsetX || 0
        : action.position?.to?.offsetX || 0;

    // 渲染服装选择器
    const costumeSelect = card.querySelector(".layout-costume-select");
    if (costumeSelect) {
      const availableCostumes =
        editorService.costumeManager.availableCostumes[characterName] || [];
      const optionsHash = availableCostumes.join("|");
      const lastHash = costumeSelect.dataset.optionsHash;
      const lastChar = costumeSelect.dataset.characterName;

      if (lastHash !== optionsHash || lastChar !== characterName) {
        DOMUtils.clearElement(costumeSelect);
        availableCostumes.forEach((costumeId) => {
          const option = new Option(costumeId, costumeId);
          costumeSelect.add(option);
        });

        if (action.costume && !availableCostumes.includes(action.costume)) {
          const option = new Option(
            `${action.costume} (自定义)`,
            action.costume
          );
          costumeSelect.add(option, 0);
        }

        costumeSelect.dataset.optionsHash = optionsHash;
        costumeSelect.dataset.characterName = characterName || "";
      }

      costumeSelect.value = action.costume;
    }

    // 填充主位置下拉选项
    if (positionSelect) {
      if (!positionSelect.dataset.optionsReady) {
        DOMUtils.clearElement(positionSelect);
        Object.entries(editorService.positionManager.positionNames).forEach(
          ([value, name]) => {
            positionSelect.add(new Option(name, value));
          }
        );
        positionSelect.dataset.optionsReady = "true";
      }
      positionSelect.value = currentPosition;
    }

    if (offsetInput) {
      offsetInput.value = currentOffset;
    }

    // 处理终点位置容器
    const toPositionContainer = card.querySelector(".to-position-container");
    const toPositionSelect = card.querySelector(".layout-position-select-to");
    const toggleBtn = card.querySelector(".toggle-position-btn");
    const mainPositionLabel = card.querySelector(".main-position-label");
    const mainOffsetLabel = card.querySelector(".main-offset-label");

    // 填充终点的下拉选项
    if (toPositionSelect && !toPositionSelect.dataset.optionsReady) {
      DOMUtils.clearElement(toPositionSelect);
      Object.entries(editorService.positionManager.positionNames).forEach(
        ([value, name]) => {
          toPositionSelect.add(new Option(name, value));
        }
      );
      toPositionSelect.dataset.optionsReady = "true";
    }

    // 根据 _independentToPosition 标记决定是否显示第二个位置行
    if (action._independentToPosition) {
      // 展开模式：修改标签为"起点"，显示终点配置
      if (toPositionContainer) {
        toPositionContainer.style.display = "grid";
      }
      if (mainPositionLabel) mainPositionLabel.textContent = "起点:";
      if (mainOffsetLabel) mainOffsetLabel.textContent = "偏移:";

      // 填充终点的值
      const toSide = action.position?.to?.side || "center";
      const toOffsetX = action.position?.to?.offsetX || 0;
      if (toPositionSelect) {
        toPositionSelect.value = toSide;
      }
      const toOffsetInput = card.querySelector(".layout-offset-input-to");
      if (toOffsetInput) {
        toOffsetInput.value = toOffsetX;
      }

      // 如果有切换按钮，添加展开状态
      if (toggleBtn && showToggleButton) {
        toggleBtn.classList.add("expanded");
      }
    } else {
      // 收起模式：标签显示"位置"，隐藏终点配置
      if (toPositionContainer) {
        toPositionContainer.style.display = "none";
      }
      if (mainPositionLabel) mainPositionLabel.textContent = "位置:";
      if (mainOffsetLabel) mainOffsetLabel.textContent = "偏移:";

      // 如果有切换按钮，移除展开状态
      if (toggleBtn && showToggleButton) {
        toggleBtn.classList.remove("expanded");
      }
    }

    // 控制切换按钮的显示/隐藏
    if (toggleBtn) {
      if (showToggleButton) {
        toggleBtn.classList.remove("hidden");
      } else {
        toggleBtn.classList.add("hidden");
      }
    }
  },
};
