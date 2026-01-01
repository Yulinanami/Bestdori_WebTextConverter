// 编辑器的“内核”：负责状态管理 + 撤销/重做（通过 immer patches）。

import { historyManager } from "@managers/historyManager.js";
import { applyPatches, enablePatches, produceWithPatches } from "immer";

enablePatches();

export class BaseEditor {
  constructor(config = {}) {
    // 项目状态
    this.projectFileState = null;
    this.originalStateOnOpen = null;
    this.activeGroupIndex = 0;

    // 配置回调函数
    this.renderCallback = config.renderCallback || (() => {});

    // 分组大小配置
    this.groupSize = config.groupSize || 50;
  }

  // 执行一次“可撤销的修改”（changeFn 会修改 draft）
  executeCommand(changeFn, options = {}) {
    const beforeState = this.projectFileState || {};
    const [nextState, patches, inversePatches] = produceWithPatches(
      beforeState,
      (draft) => {
        changeFn(draft);
      }
    );

    if (options.skipIfNoChange && patches.length === 0) {
      return;
    }
    if (!patches.length) return;

    let executedOnce = false;
    const command = {
      execute: () => {
        // 第一次执行直接使用 produceWithPatches 的产物，避免重复应用补丁
        if (!executedOnce) {
          executedOnce = true;
          this.projectFileState = nextState;
        } else {
          this.projectFileState = applyPatches(this.projectFileState, patches);
        }
        this.renderCallback();
      },
      undo: () => {
        this.projectFileState = applyPatches(
          this.projectFileState,
          inversePatches
        );
        this.renderCallback();
      },
    };

    historyManager.do(command);
  }

  // 分组模式下：把“组内索引”换算成“全局索引”
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

  // 备份：记录打开编辑器时的原始状态（用于判断是否有未保存更改）
  backupState() {
    this.originalStateOnOpen = JSON.stringify(this.projectFileState);
  }

  // 清理备份：保存成功后就不再提示“未保存更改”
  clearBackup() {
    this.originalStateOnOpen = null;
  }

  // 分组模式下：计算列表里“分组标题”占用的偏移量
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
