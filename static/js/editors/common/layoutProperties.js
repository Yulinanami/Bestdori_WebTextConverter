// 布局卡片上的输入项

import { DOMUtils } from "@utils/DOMUtils.js";
import { costumeManager } from "@managers/costumeManager.js";
import { positionManager } from "@managers/positionManager.js";

// 先保存修改前的值
function readLayoutSnapshot(action, targetClassName) {
  if (!action) {
    return { field: targetClassName, beforeValue: undefined };
  }
  if (targetClassName.includes("layout-type-select")) {
    return { field: "layoutType", beforeValue: action.layoutType };
  }
  if (targetClassName.includes("layout-costume-select")) {
    return { field: "costume", beforeValue: action.costume };
  }
  if (targetClassName.includes("layout-position-select-to")) {
    return { field: "position.to.side", beforeValue: action.position?.to?.side };
  }
  if (targetClassName.includes("layout-offset-input-to")) {
    return {
      field: "position.to.offsetX",
      beforeValue: action.position?.to?.offsetX,
    };
  }
  if (targetClassName.includes("layout-position-select")) {
    if (action.customToPosition) {
      return {
        field: "position.from.side",
        beforeValue: action.position?.from?.side,
      };
    }
    if (action.layoutType === "move") {
      return {
        field: "position.to.side",
        beforeValue: action.position?.to?.side,
      };
    }
    return {
      field: "position.from.side & position.to.side",
      beforeValue: {
        from: action.position?.from?.side,
        to: action.position?.to?.side,
      },
    };
  }
  if (targetClassName.includes("layout-offset-input")) {
    if (action.customToPosition) {
      return {
        field: "position.from.offsetX",
        beforeValue: action.position?.from?.offsetX,
      };
    }
    if (action.layoutType === "move") {
      return {
        field: "position.to.offsetX",
        beforeValue: action.position?.to?.offsetX,
      };
    }
    return {
      field: "position.from.offsetX & position.to.offsetX",
      beforeValue: {
        from: action.position?.from?.offsetX,
        to: action.position?.to?.offsetX,
      },
    };
  }
  return { field: targetClassName, beforeValue: undefined };
}

const layoutMethods = {
  _layoutHandlers: {
    // 修改布局类型
    "layout-type-select": (action, value) => {
      action.layoutType = value;
    },

    // 修改服装
    "layout-costume-select": (action, value) => {
      action.costume = value;
    },

    // 修改终点位置
    "layout-position-select-to": (action, value) => {
      if (!action.position) action.position = {};
      if (!action.position.to) action.position.to = {};
      action.position.to.side = value;
    },

    // 修改终点偏移
    "layout-offset-input-to": (action, value) => {
      if (!action.position) action.position = {};
      if (!action.position.to) action.position.to = {};
      action.position.to.offsetX = value;
    },

    // 修改主位置
    "layout-position-select": (action, value) => {
      if (!action.position) action.position = {};

      // 没展开时
      if (!action.customToPosition) {
        // move 时改终点
        if (action.layoutType === "move") {
          if (!action.position.to) action.position.to = {};
          action.position.to.side = value;
        } else {
          // 其它类型同时改起点和终点
          if (!action.position.from) action.position.from = {};
          action.position.from.side = value;
          if (!action.position.to) action.position.to = {};
          action.position.to.side = value;
        }
      } else {
        // 展开后只改起点
        if (!action.position.from) action.position.from = {};
        action.position.from.side = value;
      }
    },

    // 修改主偏移
    "layout-offset-input": (action, value) => {
      if (!action.position) action.position = {};

      // 没展开时
      if (!action.customToPosition) {
        // move 时改终点
        if (action.layoutType === "move") {
          if (!action.position.to) action.position.to = {};
          action.position.to.offsetX = value;
        } else {
          // 其它类型同时改起点和终点
          if (!action.position.from) action.position.from = {};
          action.position.from.offsetX = value;
          if (!action.position.to) action.position.to = {};
          action.position.to.offsetX = value;
        }
      } else {
        // 展开后只改起点
        if (!action.position.from) action.position.from = {};
        action.position.from.offsetX = value;
      }
    },
  },

  // 把一个输入项的变化写回动作数据
  updateLayoutField(actionId, targetElement) {
    const targetValue =
      targetElement.type === "number"
        ? parseInt(targetElement.value) || 0
        : targetElement.value;
    const targetClassName = targetElement.className;
    const currentAction = this.projectFileState?.actions?.find(
      (actionItem) => actionItem.id === actionId
    );
    const snapshot = readLayoutSnapshot(currentAction, targetClassName);
    // 先记录修改前后的值
    this.markLayoutChange?.(actionId, {
      source: "ui",
      field: snapshot.field,
      beforeValue: snapshot.beforeValue,
      afterValue: targetValue,
    });

    // 再写入动作数据
    this.executeCommand((currentState) => {
      const action = currentState.actions.find(
        (actionItem) => actionItem.id === actionId
      );
      if (!action) return;

      // 按控件类名找到对应字段的写回方法
      const handlerKey = Object.keys(this._layoutHandlers).find((key) =>
        targetClassName.includes(key),
      );

      if (handlerKey) {
        this._layoutHandlers[handlerKey](action, targetValue);
      }
    });
  },

  // 刷新布局卡片上的控件内容
  renderLayoutControls(card, action, characterName, options = {}) {
    const { showToggleButton = false } = options;

    const typeSelect = card.querySelector(".layout-type-select");
    if (typeSelect) {
      typeSelect.value = action.layoutType;
    }

    const positionSelect = card.querySelector(".layout-position-select");
    const offsetInput = card.querySelector(".layout-offset-input");

    const isExpanded = action.customToPosition;
    const isMove = action.layoutType === "move";
    const currentPosition =
      isExpanded || !isMove
        ? action.position?.from?.side || "center"
        : action.position?.to?.side || "center";
    const currentOffset =
      isExpanded || !isMove
        ? action.position?.from?.offsetX || 0
        : action.position?.to?.offsetX || 0;

    const costumeSelect = card.querySelector(".layout-costume-select");
    if (costumeSelect) {
      const availableCostumes =
        costumeManager.availableCostumes[characterName] || [];
      const optionsHash = availableCostumes.join("|");
      const lastHash = costumeSelect.dataset.optionsHash;
      const lastChar = costumeSelect.dataset.characterName;

      // 服装列表跟角色走 角色或候选变了就整组重建
      if (lastHash !== optionsHash || lastChar !== characterName) {
        // 服装列表变了就重新生成选项
        DOMUtils.clearElement(costumeSelect);
        availableCostumes.forEach((costumeId) => {
          const option = new Option(costumeId, costumeId);
          costumeSelect.add(option);
        });

        if (action.costume && !availableCostumes.includes(action.costume)) {
          const option = new Option(
            `${action.costume} (自定义)`,
            action.costume,
          );
          costumeSelect.add(option, 0);
        }

        costumeSelect.dataset.optionsHash = optionsHash;
        costumeSelect.dataset.characterName = characterName || "";
      }

      costumeSelect.value = action.costume;
    }

    if (positionSelect) {
      // 位置选项只生成一次 后面只改当前值
      if (!positionSelect.dataset.optionsReady) {
        DOMUtils.clearElement(positionSelect);
        Object.entries(positionManager.positionNames).forEach(
          ([value, name]) => {
            positionSelect.add(new Option(name, value));
          },
        );
        positionSelect.dataset.optionsReady = "true";
      }
      positionSelect.value = currentPosition;
    }

    if (offsetInput) {
      offsetInput.value = currentOffset;
    }

    const toPositionContainer = card.querySelector(".to-position-container");
    const toPositionSelect = card.querySelector(".layout-position-select-to");
    const toggleButton = card.querySelector(".toggle-position-btn");
    const mainPositionLabel = card.querySelector(".main-position-label");
    const mainOffsetLabel = card.querySelector(".main-offset-label");

    if (toPositionSelect && !toPositionSelect.dataset.optionsReady) {
      DOMUtils.clearElement(toPositionSelect);
      Object.entries(positionManager.positionNames).forEach(
        ([value, name]) => {
          toPositionSelect.add(new Option(name, value));
        },
      );
      toPositionSelect.dataset.optionsReady = "true";
    }

    // 展开后起点和终点分开显示 没展开时共用主控件
    if (action.customToPosition) {
      if (toPositionContainer) {
        toPositionContainer.style.display = "grid";
      }
      if (mainPositionLabel) mainPositionLabel.textContent = "起点:";
      if (mainOffsetLabel) mainOffsetLabel.textContent = "偏移:";

      const toSide = action.position?.to?.side || "center";
      const toOffsetX = action.position?.to?.offsetX || 0;
      if (toPositionSelect) {
        toPositionSelect.value = toSide;
      }
      const toOffsetInput = card.querySelector(".layout-offset-input-to");
      if (toOffsetInput) {
        toOffsetInput.value = toOffsetX;
      }

      if (toggleButton && showToggleButton) {
        toggleButton.classList.add("expanded");
      }
    } else {
      if (toPositionContainer) {
        toPositionContainer.style.display = "none";
      }
      if (mainPositionLabel) mainPositionLabel.textContent = "位置:";
      if (mainOffsetLabel) mainOffsetLabel.textContent = "偏移:";

      if (toggleButton && showToggleButton) {
        toggleButton.classList.remove("expanded");
      }
    }

    if (toggleButton) {
      if (showToggleButton) {
        toggleButton.classList.remove("hidden");
      } else {
        toggleButton.classList.add("hidden");
      }
    }
  },
};

// 给编辑器添加布局输入处理方法
export function attachLayoutUI(editor) {
  Object.assign(editor, layoutMethods);
}
