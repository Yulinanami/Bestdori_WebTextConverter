// 常用 DOM 小工具：创建元素、清空、批量 append、显示/隐藏等。

export const DOMUtils = {
  // 创建一个元素，并顺便设置属性/事件/子节点
  createElement(tag, attrs = {}, children = null) {
    const element = document.createElement(tag);

    // 设置属性
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === "className") {
        element.className = value;
      } else if (key === "style" && typeof value === "object") {
        Object.assign(element.style, value);
      } else if (key.startsWith("on") && typeof value === "function") {
        const eventName = key.slice(2).toLowerCase();
        element.addEventListener(eventName, value);
      } else if (key === "dataset" && typeof value === "object") {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
      } else {
        element.setAttribute(key, value);
      }
    });

    // 添加子元素
    if (children) {
      if (typeof children === "string") {
        element.textContent = children;
      } else if (Array.isArray(children)) {
        children.forEach((child) => {
          if (child instanceof Element) {
            element.appendChild(child);
          } else if (typeof child === "string") {
            element.appendChild(document.createTextNode(child));
          }
        });
      } else if (children instanceof Element) {
        element.appendChild(children);
      }
    }

    return element;
  },

  // 清空一个元素的内容（可传元素或元素 id）
  clearElement(elementOrId) {
    const element =
      typeof elementOrId === "string"
        ? document.getElementById(elementOrId)
        : elementOrId;
    if (element) {
      element.innerHTML = "";
    }
  },

  // 把一组子元素批量 append 到父元素（用 fragment 减少重排）
  appendChildren(parent, children) {
    const fragment = document.createDocumentFragment();
    children.forEach((child) => {
      if (child instanceof Element) {
        fragment.appendChild(child);
      }
    });
    parent.appendChild(fragment);
  },

  // 显示/隐藏一个元素（display: block/none）
  toggleDisplay(elementOrId, show) {
    const element =
      typeof elementOrId === "string"
        ? document.getElementById(elementOrId)
        : elementOrId;
    if (element) {
      element.style.display = show ? "block" : "none";
    }
  },

  // 查询多个元素（querySelectorAll 的小包装）
  getElements(selector, parent = document) {
    return parent.querySelectorAll(selector);
  },

  // 创建一个按钮，并可选绑定点击事件
  createButton(text, className = "btn", onClick = null) {
    const button = this.createElement("button", { className }, text);
    if (onClick) {
      button.addEventListener("click", onClick);
    }
    return button;
  },

  // 给布局卡片加上对应的样式类（appear/move/hide）
  applyLayoutTypeClass(element, layoutType) {
    // 移除所有布局类型类名
    element.classList.remove(
      "layout-type-appear",
      "layout-type-move",
      "layout-type-hide"
    );

    // 根据类型添加对应的类名
    if (layoutType === "appear") {
      element.classList.add("layout-type-appear");
    } else if (layoutType === "move") {
      element.classList.add("layout-type-move");
    } else if (layoutType === "hide") {
      element.classList.add("layout-type-hide");
    }
  },
};
