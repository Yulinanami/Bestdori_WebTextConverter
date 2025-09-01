// static/js/selectionManager.js (新建文件)

export const selectionManager = {
  
  // 使用 Set 来存储选中的ID，高效且能自动去重
  selectedIds: new Set(),
  
  // 用于 Shift+点击 的最后一个被点击的项的ID
  lastSelectedId: null,

  /**
   * 初始化管理器，为列表容器添加事件委托。
   * @param {HTMLElement} container - 列表项所在的父容器元素 (例如 #speakerEditorCanvas)。
   * @param {string} itemSelector - 用于识别可选项目的CSS选择器 (例如 '.dialogue-item')。
   */
  init(container, itemSelector) {
    container.addEventListener('click', (e) => {
      const item = e.target.closest(itemSelector);
      if (!item || !item.dataset.id) return;

      const id = item.dataset.id;
      
      if (e.ctrlKey || e.metaKey) { // Ctrl (Win) 或 Cmd (Mac) 点击
        this.toggle(id);
      } else if (e.shiftKey) { // Shift 点击
        this.selectRange(id, container, itemSelector);
      } else { // 普通点击
        this.selectSingle(id);
      }
      
      this.lastSelectedId = id;
      
      // 触发一个自定义事件，通知其他模块选项已改变
      container.dispatchEvent(new CustomEvent('selectionchange', {
        detail: { selectedIds: this.getSelectedIds() }
      }));
    });
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
    const ids = items.map(item => item.dataset.id);
    
    const startIndex = ids.indexOf(this.lastSelectedId);
    const endIndex = ids.indexOf(endId);
    
    if (startIndex === -1 || endIndex === -1) return;
    
    const [start, end] = [startIndex, endIndex].sort((a, b) => a - b);
    const rangeIds = ids.slice(start, end + 1);
    
    // this.clear(); // 取决于您想要的行为，不清空可以实现多范围选择
    rangeIds.forEach(id => this.selectedIds.add(id));
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