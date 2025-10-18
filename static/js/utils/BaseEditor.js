/**
 * 编辑器基类 - 提供所有编辑器的共同功能
 *
 * 用于 speakerEditor、live2dEditor、expressionEditor 的通用逻辑
 */

import { historyManager } from "../historyManager.js";
import { DataUtils } from "./DataUtils.js";

export class BaseEditor {
  constructor(config = {}) {
    // 项目状态
    this.projectFileState = null;
    this.originalStateOnOpen = null;
    this.activeGroupIndex = 0;

    // 配置回调函数
    this.renderCallback = config.renderCallback || (() => {});
    this.afterCommandCallback = config.afterCommandCallback || (() => {});

    // 分组大小配置
    this.groupSize = config.groupSize || 50;
  }

  /**
   * 执行命令并支持撤销/恢复
   * @param {Function} changeFn - 修改状态的函数
   * @param {Object} options - 可选配置
   * @param {boolean} options.skipIfNoChange - 如果状态未改变则跳过执行
   */
  executeCommand(changeFn, options = {}) {
    const beforeState = JSON.stringify(this.projectFileState);

    // 如果需要检查状态是否改变
    if (options.skipIfNoChange) {
      const tempState = DataUtils.deepClone(this.projectFileState);
      changeFn(tempState);
      const afterState = JSON.stringify(tempState);

      // 状态未改变，直接返回
      if (beforeState === afterState) {
        return;
      }
    }

    const command = {
      execute: () => {
        const newState = JSON.parse(beforeState);
        changeFn(newState);
        this.projectFileState = newState;
        this.afterCommandCallback(); // 先执行回调（清除缓存等）
        this.renderCallback(); // 再渲染
      },
      undo: () => {
        this.projectFileState = JSON.parse(beforeState);
        this.afterCommandCallback(); // 先执行回调（清除缓存等）
        this.renderCallback(); // 再渲染
      },
    };

    historyManager.do(command);
  }

  /**
   * 在分组模式下，将本地索引转换为全局索引
   * @param {number} localIndex - 组内的本地索引
   * @param {boolean} isGroupingEnabled - 是否启用分组
   * @returns {number} 全局索引
   */
  getGlobalIndex(localIndex, isGroupingEnabled = false) {
    if (
      !isGroupingEnabled ||
      this.activeGroupIndex === null ||
      this.activeGroupIndex < 0
    ) {
      return localIndex;
    }

    // 当前分组的起始位置 = 分组索引 × 每组大小
    const offset = this.activeGroupIndex * this.groupSize;
    return offset + localIndex;
  }

  /**
   * 备份当前状态（用于编辑器打开时）
   */
  backupState() {
    this.originalStateOnOpen = JSON.stringify(this.projectFileState);
  }

  /**
   * 恢复到备份的状态（用于取消编辑）
   */
  restoreState() {
    if (this.originalStateOnOpen) {
      this.projectFileState = JSON.parse(this.originalStateOnOpen);
      this.originalStateOnOpen = null;
    }
  }

  /**
   * 检查状态是否有更改
   * @returns {boolean} 是否有更改
   */
  hasChanges() {
    if (!this.originalStateOnOpen) {
      return false;
    }
    return JSON.stringify(this.projectFileState) !== this.originalStateOnOpen;
  }

  /**
   * 清理备份状态（用于保存后）
   */
  clearBackup() {
    this.originalStateOnOpen = null;
  }

  /**
   * 计算本地索引（从 DOM 索引减去标题偏移）
   * @param {number} domIndex - DOM 中的索引
   * @param {boolean} isGroupingEnabled - 是否启用分组
   * @returns {number} 本地索引
   */
  calculateLocalIndex(domIndex, isGroupingEnabled = false) {
    if (
      !isGroupingEnabled ||
      this.activeGroupIndex === null ||
      this.activeGroupIndex < 0
    ) {
      return domIndex;
    }

    // 减去前面所有分组标题（包括当前分组）占据的位置
    const headerOffset = this.activeGroupIndex + 1;
    return Math.max(0, domIndex - headerOffset);
  }

  /**
   * 获取标题偏移量
   * @param {boolean} isGroupingEnabled - 是否启用分组
   * @returns {number} 标题偏移量
   */
  getHeaderOffset(isGroupingEnabled = false) {
    if (
      !isGroupingEnabled ||
      this.activeGroupIndex === null ||
      this.activeGroupIndex < 0
    ) {
      return 0;
    }
    return this.activeGroupIndex + 1;
  }
}
