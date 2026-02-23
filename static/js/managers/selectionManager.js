export const selectionManager = {
  selectedIds: new Set(),
  lastSelectedId: null,
  _onContainerClick: null,

  // 让一个列表容器支持“点击/Shift/Ctrl 多选”（itemSelector 用来找到每一项）
  attach(container, itemSelector) {
    if (this._onContainerClick) {
      this.detach(container);
    }
    this._onContainerClick = this._handleClick.bind(
      this,
      container,
      itemSelector
    );
    container.addEventListener("click", this._onContainerClick);
  },

  // 取消绑定（销毁页面/切换视图时用，避免重复绑定）
  detach(container) {
    if (this._onContainerClick) {
      container.removeEventListener("click", this._onContainerClick);
      this._onContainerClick = null;
    }
  },

  // Ctrl/Command 点击：把某一项加入/移出“已选中集合”
  toggle(itemId) {
    if (this.selectedIds.has(itemId)) {
      this.selectedIds.delete(itemId);
    } else {
      this.selectedIds.add(itemId);
    }
  },

  // 普通点击：只保留一个选中项
  selectSingle(itemId) {
    this.selectedIds.clear();
    this.selectedIds.add(itemId);
  },

  // Shift 点击：把“上一次选中的项”到“当前项”之间的全部选中
  selectRange(endId, container, itemSelector) {
    if (!this.lastSelectedId) {
      this.selectSingle(endId);
      return;
    }

    const listItems = Array.from(container.querySelectorAll(itemSelector));
    const itemIds = listItems.map((listItem) => listItem.dataset.id);
    const startIndex = itemIds.indexOf(this.lastSelectedId);
    const endIndex = itemIds.indexOf(endId);

    if (startIndex === -1 || endIndex === -1) return;
    const [start, end] = [startIndex, endIndex].sort(
      (leftIndex, rightIndex) => leftIndex - rightIndex
    );
    const rangeIds = itemIds.slice(start, end + 1);
    rangeIds.forEach((itemId) => this.selectedIds.add(itemId));
  },

  // 内部方法：统一处理点击，决定是单选、Ctrl 切换，还是 Shift 选范围
  _handleClick(container, itemSelector, clickEvent) {
    const clickedItem = clickEvent.target.closest(itemSelector);
    if (!clickedItem || !clickedItem.dataset.id) return;
    const selectedItemId = clickedItem.dataset.id;

    if (clickEvent.ctrlKey || clickEvent.metaKey) {
      this.toggle(selectedItemId);
    } else if (clickEvent.shiftKey) {
      this.selectRange(selectedItemId, container, itemSelector);
    } else {
      const isAlreadyOnlySelected =
        this.selectedIds.has(selectedItemId) && this.selectedIds.size === 1;
      if (isAlreadyOnlySelected) {
        this.selectedIds.clear();
      } else {
        this.selectSingle(selectedItemId);
      }
    }

    this.lastSelectedId = this.selectedIds.has(selectedItemId)
      ? selectedItemId
      : null;
    container.dispatchEvent(
      new CustomEvent("selectionchange", {
        detail: { selectedIds: Array.from(this.selectedIds) },
      }),
    );
  },
};
