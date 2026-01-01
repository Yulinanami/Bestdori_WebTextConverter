export const selectionManager = {
  selectedIds: new Set(),
  lastSelectedId: null,
  _boundClickHandler: null,

  // 让一个列表容器支持“点击/Shift/Ctrl 多选”（itemSelector 用来找到每一项）
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

  // 取消绑定（销毁页面/切换视图时用，避免重复绑定）
  detach(container) {
    if (this._boundClickHandler) {
      container.removeEventListener("click", this._boundClickHandler);
      this._boundClickHandler = null;
    }
  },

  // 统一处理点击：决定是单选、Ctrl 切换，还是 Shift 选范围
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

  // Ctrl/Command 点击：把某一项加入/移出“已选中集合”
  toggle(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  },

  // 普通点击：只保留一个选中项
  selectSingle(id) {
    this.clear();
    this.selectedIds.add(id);
  },

  // Shift 点击：把“上一次选中的项”到“当前项”之间的全部选中
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

  // 清空所有选中项
  clear() {
    this.selectedIds.clear();
  },

  // 获取当前选中的 id 列表（数组形式）
  getSelectedIds() {
    return Array.from(this.selectedIds);
  },
};
