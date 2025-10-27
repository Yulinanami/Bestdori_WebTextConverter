export const selectionManager = {
  selectedIds: new Set(),
  lastSelectedId: null,
  _boundClickHandler: null,

  /**
   * 绑定事件监听器到容器。
   * @param {HTMLElement} container - 列表项所在的父容器元素。
   * @param {string} itemSelector - 用于识别可选项目的CSS选择器。
   */
  attach(container, itemSelector) {
    if (this._boundClickHandler) {
      this.detach(container);
    }
    this._boundClickHandler = this._handleClick.bind(
      this,
      container,
      itemSelector
    );
    container.addEventListener("click", this._boundClickHandler);
  },

  /**
   * 从容器解绑事件监听器。
   * @param {HTMLElement} container - 列表项所在的父容器元素。
   */
  detach(container) {
    if (this._boundClickHandler) {
      container.removeEventListener("click", this._boundClickHandler);
      this._boundClickHandler = null;
    }
  },

  _handleClick(container, itemSelector, e) {
    const item = e.target.closest(itemSelector);
    if (!item || !item.dataset.id) return;
    const id = item.dataset.id;

    if (e.ctrlKey || e.metaKey) {
      this.toggle(id);
    } else if (e.shiftKey) {
      this.selectRange(id, container, itemSelector);
    } else {
      const isAlreadyOnlySelected =
        this.selectedIds.has(id) && this.selectedIds.size === 1;
      if (isAlreadyOnlySelected) {
        this.clear();
      } else {
        this.selectSingle(id);
      }
    }

    this.lastSelectedId = this.selectedIds.has(id) ? id : null;
    container.dispatchEvent(
      new CustomEvent("selectionchange", {
        detail: { selectedIds: this.getSelectedIds() },
      })
    );
  },

  /**
   * 切换单个项目的选中状态。
   * @param {string} id - 项目的ID。
   */
  toggle(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  },

  /**
   * 只选中单个项目。
   * @param {string} id - 项目的ID。
   */
  selectSingle(id) {
    this.clear();
    this.selectedIds.add(id);
  },

  /**
   * 选中一个范围内的所有项目。
   * @param {string} endId - Shift+点击的结束项目的ID。
   * @param {HTMLElement} container - 列表容器。
   * @param {string} itemSelector - 项目选择器。
   */
  selectRange(endId, container, itemSelector) {
    if (!this.lastSelectedId) {
      this.selectSingle(endId);
      return;
    }

    const items = Array.from(container.querySelectorAll(itemSelector));
    const ids = items.map((item) => item.dataset.id);
    const startIndex = ids.indexOf(this.lastSelectedId);
    const endIndex = ids.indexOf(endId);

    if (startIndex === -1 || endIndex === -1) return;
    const [start, end] = [startIndex, endIndex].sort((a, b) => a - b);
    const rangeIds = ids.slice(start, end + 1);
    rangeIds.forEach((id) => this.selectedIds.add(id));
  },

  /**
   * 清除所有选项。
   */
  clear() {
    this.selectedIds.clear();
  },

  /**
   * 获取当前所有选中项的ID数组。
   * @returns {string[]}
   */
  getSelectedIds() {
    return Array.from(this.selectedIds);
  },
};
