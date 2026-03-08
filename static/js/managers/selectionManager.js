// 列表里的选中状态
export const selectionManager = {
  selectedIds: new Set(),
  lastSelectedId: null,

  // 切换一项的选中状态
  toggle(itemId) {
    if (this.selectedIds.has(itemId)) {
      this.selectedIds.delete(itemId);
    } else {
      this.selectedIds.add(itemId);
    }
  },

  // 只保留一个选中项
  selectSingle(itemId) {
    this.selectedIds.clear();
    this.selectedIds.add(itemId);
  },

  // 选中一整段内容
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
    // 把前后顺序排好
    const [start, end] = [startIndex, endIndex].sort(
      (leftIndex, rightIndex) => leftIndex - rightIndex
    );
    const rangeIds = itemIds.slice(start, end + 1);
    // 把这一段都加入选中集合
    rangeIds.forEach((itemId) => this.selectedIds.add(itemId));
  },
};
