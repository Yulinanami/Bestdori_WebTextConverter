// 给编辑器模块用的服务：把各种 manager 打包成一个统一入口

import { state } from "@managers/stateManager.js";
import { configManager } from "@managers/configManager.js";
import { historyManager } from "@managers/historyManager.js";
import { projectManager } from "@managers/projectManager.js";
import { pinnedCharacterManager } from "@managers/pinnedCharacterManager.js";
import { costumeManager } from "@managers/costumeManager.js";
import { positionManager } from "@managers/positionManager.js";
import {
  motionManager,
  expressionManager,
} from "@managers/genericConfigManager.js";
import { selectionManager } from "@managers/selectionManager.js";

// 编辑器服务：把常用能力（状态、配置、置顶、选择等）集中在一起
class EditorService {
  constructor(dependencyOverrides = {}) {
    // 初始化：允许外部传入依赖（测试/替换实现时很有用）
    this.state = dependencyOverrides.state || state;
    this.configManager = dependencyOverrides.configManager || configManager;
    this.historyManager = dependencyOverrides.historyManager || historyManager;
    this.projectManager = dependencyOverrides.projectManager || projectManager;
    this.pinnedCharacterManager =
      dependencyOverrides.pinnedCharacterManager || pinnedCharacterManager;
    this.costumeManager = dependencyOverrides.costumeManager || costumeManager;
    this.positionManager = dependencyOverrides.positionManager || positionManager;
    this.motionManager = dependencyOverrides.motionManager || motionManager;
    this.expressionManager =
      dependencyOverrides.expressionManager || expressionManager;
    this.selectionManager =
      dependencyOverrides.selectionManager || selectionManager;
  }

  // historyManager 已经通过 BaseEditor 集成，编辑器不需要直接访问
}

// 创建并导出单例（编辑器直接用 editorService）
export const editorService = new EditorService();

// 也导出类本身（方便测试时 new 一个并注入假依赖）
export { EditorService };
