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
  constructor(dependencies = {}) {
    // 初始化：允许外部传入依赖（测试/替换实现时很有用）
    this.state = dependencies.state || state;
    this.configManager = dependencies.configManager || configManager;
    this.historyManager = dependencies.historyManager || historyManager;
    this.projectManager = dependencies.projectManager || projectManager;
    this.pinnedCharacterManager =
      dependencies.pinnedCharacterManager || pinnedCharacterManager;
    this.costumeManager = dependencies.costumeManager || costumeManager;
    this.positionManager = dependencies.positionManager || positionManager;
    this.motionManager = dependencies.motionManager || motionManager;
    this.expressionManager =
      dependencies.expressionManager || expressionManager;
    this.selectionManager = dependencies.selectionManager || selectionManager;
  }

  // ==================== 状态管理 ====================

  // 读取当前项目（编辑进度）数据
  getProjectState() {
    return this.state.get("projectFile");
  }

  // 保存当前项目（编辑进度）数据
  setProjectState(newState) {
    this.state.set("projectFile", newState);
  }

  // 读取当前角色配置（角色名 -> ID 映射）
  getCurrentConfig() {
    return this.state.get("currentConfig");
  }

  // ==================== 角色配置 ====================

  // 在页面上更新某个角色的头像显示
  updateCharacterAvatar(container, characterId, characterName) {
    return this.configManager.updateConfigAvatar(
      container,
      characterId,
      characterName
    );
  }

  // 根据角色 ID 反查角色名（用于显示）
  getCharacterNameById(characterId) {
    return this.configManager.getCharacterNameById(characterId);
  }

  // 获取“所有角色”（返回 [name, ids] 的列表）
  getAllCharacters() {
    const config = this.getCurrentConfig();
    return Object.entries(config);
  }

  // ==================== 固定角色管理 ====================

  // 获取已置顶的角色列表（方便拖拽/快速选择）
  getPinnedCharacters() {
    return this.pinnedCharacterManager.getPinned();
  }

  // 切换某个角色是否置顶
  togglePinCharacter(characterName) {
    return this.pinnedCharacterManager.toggle(characterName);
  }

  // ==================== 选择管理 ====================

  // 清空当前多选/选择状态
  clearSelection() {
    return this.selectionManager?.clear?.();
  }

  // 从某个 DOM 上解绑选择逻辑（销毁时用）
  detachSelection(element) {
    return this.selectionManager?.detach?.(element);
  }

  // ==================== 历史记录（已通过 BaseEditor 处理）====================
  // historyManager 已经通过 BaseEditor 集成，编辑器不需要直接访问
}

// 创建并导出单例（编辑器直接用 editorService）
export const editorService = new EditorService();

// 也导出类本身（方便测试时 new 一个并注入假依赖）
export { EditorService };
