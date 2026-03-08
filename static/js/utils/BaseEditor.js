// 编辑器通用状态和撤销重做

import { historyManager } from "@managers/historyManager.js";
import { applyPatches, enablePatches, produceWithPatches } from "immer";

enablePatches();

export class BaseEditor {
  // 创建编辑器基础对象
  constructor(config = {}) {
    // 当前项目状态
    this.projectFileState = null;
    this.originalStateOnOpen = null;
    this.activeGroupIndex = 0;

    // 保存外面传进来的方法
    this.renderCallback = config.renderCallback || (() => {});
    this.commandRenderHintResolver = config.commandRenderHintResolver || null;

    // 每组默认大小
    this.groupSize = config.groupSize || 50;
  }

  // 执行一次可撤销修改
  executeCommand(changeFn, options = {}) {
    const beforeState = this.projectFileState || {};
    const [nextState, patches, inversePatches] = produceWithPatches(
      beforeState,
      // 把修改写进草稿对象
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
      // 执行这次修改
      execute: () => {
        const stateBefore = this.projectFileState;
        const phase = executedOnce ? "redo" : "execute";
        // 第一次直接用算好的结果
        if (!executedOnce) {
          executedOnce = true;
          this.projectFileState = nextState;
        } else {
          this.projectFileState = applyPatches(this.projectFileState, patches);
        }
        this.commandRenderHintResolver?.({
          phase,
          stateBefore,
          stateAfter: this.projectFileState,
          patchesApplied: patches,
          patches,
          inversePatches,
        });
        this.renderCallback();
      },
      // 撤销这次修改
      undo: () => {
        const stateBefore = this.projectFileState;
        this.projectFileState = applyPatches(
          this.projectFileState,
          inversePatches
        );
        this.commandRenderHintResolver?.({
          phase: "undo",
          stateBefore,
          stateAfter: this.projectFileState,
          patchesApplied: inversePatches,
          patches,
          inversePatches,
        });
        this.renderCallback();
      },
    };

    historyManager.do(command);
  }

  // 把组内序号换成全局序号
  resolveGlobalIndex(localIndex, isGroupingEnabled = false) {
    if (
      !isGroupingEnabled ||
      this.activeGroupIndex === null ||
      this.activeGroupIndex < 0
    ) {
      return localIndex;
    }

    // 算出当前组在全列表里的起点
    const offset = this.activeGroupIndex * this.groupSize;
    return offset + localIndex;
  }

  // 算出分组头占了多少位置
  resolveHeaderOffset(isGroupingEnabled = false) {
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
