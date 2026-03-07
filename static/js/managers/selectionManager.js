export const selectionManager = {
  selectedIds: new Set(),
  lastSelectedId: null,

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
};
