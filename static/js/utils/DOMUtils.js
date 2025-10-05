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
   * 创建头像元素（用于配置列表）
   * @param {number} characterId - 角色 ID
   * @param {string} characterName - 角色名称
   * @param {Function} getAvatarId - 获取头像 ID 的函数
   * @returns {HTMLElement}
   */
  createAvatarElement(characterId, characterName, getAvatarId = (id) => id) {
    const avatarId = getAvatarId(characterId);
    const avatar = this.createElement("div", {
      className: "config-avatar",
      dataset: { id: characterId },
    });

    if (avatarId > 0) {
      const img = this.createElement("img", {
        src: `/static/images/avatars/${avatarId}.png`,
        alt: characterName,
        className: "config-avatar-img",
      });

      img.onerror = () => {
        avatar.textContent = characterName.charAt(0);
        avatar.classList.add("fallback");
        img.remove();
      };

      avatar.appendChild(img);
    } else {
      avatar.textContent = characterName.charAt(0);
      avatar.classList.add("fallback");
    }

    return avatar;
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
   * 创建选项元素（用于 select）
   * @param {string} value - 选项值
   * @param {string} text - 显示文本
   * @param {boolean} selected - 是否选中
   * @returns {HTMLOptionElement}
   */
  createOption(value, text, selected = false) {
    const option = this.createElement("option", { value }, text);
    if (selected) {
      option.selected = true;
    }
    return option;
  },

  /**
   * 填充 select 元素
   * @param {HTMLSelectElement} selectElement - select 元素
   * @param {Array} options - 选项数组 [{value, text, selected?}]
   * @param {boolean} clearFirst - 是否先清空
   */
  populateSelect(selectElement, options, clearFirst = true) {
    if (clearFirst) {
      selectElement.innerHTML = "";
    }

    options.forEach((opt) => {
      const option = this.createOption(
        opt.value,
        opt.text || opt.value,
        opt.selected
      );
      selectElement.appendChild(option);
    });
  },

  /**
   * 创建加载提示元素
   * @param {string} message - 提示消息
   * @returns {HTMLElement}
   */
  createLoadingElement(message = "加载中...") {
    return this.createElement(
      "div",
      { className: "loading-container" },
      [
        this.createElement("div", { className: "loading" }),
        this.createElement("div", { className: "loading-text" }, message),
      ]
    );
  },

  /**
   * 创建空状态提示元素
   * @param {string} message - 提示消息
   * @returns {HTMLElement}
   */
  createEmptyState(message = "暂无数据") {
    return this.createElement(
      "div",
      { className: "empty-state" },
      message
    );
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
   * 安全地获取元素
   * @param {string} selector - 选择器
   * @param {HTMLElement} parent - 父元素
   * @returns {HTMLElement|null}
   */
  getElement(selector, parent = document) {
    return parent.querySelector(selector);
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
   * 添加事件监听器（支持事件委托）
   * @param {HTMLElement} parent - 父元素
   * @param {string} eventType - 事件类型
   * @param {string} selector - 子元素选择器
   * @param {Function} handler - 事件处理函数
   */
  delegate(parent, eventType, selector, handler) {
    parent.addEventListener(eventType, (event) => {
      const target = event.target.closest(selector);
      if (target && parent.contains(target)) {
        handler.call(target, event);
      }
    });
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
};
