/**
 * DOMUtils - DOM 操作工具函数
 * 减少重复的 DOM 操作代码
 */

export const DOMUtils = {
  /**
   * 创建元素并设置属性
   * @param {string} tag - 标签名
   * @param {object} attrs - 属性对象
   * @param {string|Element|Element[]} children - 子元素
   * @returns {HTMLElement}
   */
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

  /**
   * 清空元素内容
   * @param {string|HTMLElement} elementOrId - 元素或元素 ID
   */
  clearElement(elementOrId) {
    const element =
      typeof elementOrId === "string"
        ? document.getElementById(elementOrId)
        : elementOrId;
    if (element) {
      element.innerHTML = "";
    }
  },

  /**
   * 批量添加子元素
   * @param {HTMLElement} parent - 父元素
   * @param {HTMLElement[]} children - 子元素数组
   */
  appendChildren(parent, children) {
    const fragment = document.createDocumentFragment();
    children.forEach((child) => {
      if (child instanceof Element) {
        fragment.appendChild(child);
      }
    });
    parent.appendChild(fragment);
  },

  /**
   * 切换元素的显示/隐藏
   * @param {string|HTMLElement} elementOrId - 元素或元素 ID
   * @param {boolean} show - 是否显示
   */
  toggleDisplay(elementOrId, show) {
    const element =
      typeof elementOrId === "string"
        ? document.getElementById(elementOrId)
        : elementOrId;
    if (element) {
      element.style.display = show ? "block" : "none";
    }
  },

  /**
   * 安全地获取多个元素
   * @param {string} selector - 选择器
   * @param {HTMLElement} parent - 父元素
   * @returns {NodeList}
   */
  getElements(selector, parent = document) {
    return parent.querySelectorAll(selector);
  },

  /**
   * 创建按钮元素
   * @param {string} text - 按钮文本
   * @param {string} className - CSS 类名
   * @param {Function} onClick - 点击事件处理函数
   * @returns {HTMLButtonElement}
   */
  createButton(text, className = "btn", onClick = null) {
    const button = this.createElement("button", { className }, text);
    if (onClick) {
      button.addEventListener("click", onClick);
    }
    return button;
  },

  /**
   * 应用布局类型 CSS 类名
   * 移除所有布局类型类名，然后根据 layoutType 添加对应的类名
   * @param {HTMLElement} element - 目标元素
   * @param {string} layoutType - 布局类型 ("appear" | "move" | "hide")
   */
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
