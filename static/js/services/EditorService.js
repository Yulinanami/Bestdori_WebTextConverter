/**
 * EditorService - Facade 模式聚合编辑器依赖
 *
 * 目的：
 * 1. 减少编辑器直接依赖的 Manager 数量（从 7-8 个减少到 1 个）
 * 2. 提供统一的编辑器 API 接口
 * 3. 隐藏内部实现细节
 * 4. 便于单元测试（可注入 mock service）
 */

import { state } from "../stateManager.js";
import { configManager } from "../configManager.js";
import { historyManager } from "../historyManager.js";
import { projectManager } from "../projectManager.js";
import { pinnedCharacterManager } from "../pinnedCharacterManager.js";
import { costumeManager } from "../costumeManager.js";
import { positionManager } from "../positionManager.js";
import { motionManager, expressionManager } from "../genericConfigManager.js";
import { selectionManager } from "../selectionManager.js";

/**
 * 编辑器服务 - 聚合所有编辑器需要的功能
 */
class EditorService {
  constructor(dependencies = {}) {
    // 依赖注入，支持测试时替换
    this.state = dependencies.state || state;
    this.configManager = dependencies.configManager || configManager;
    this.historyManager = dependencies.historyManager || historyManager;
    this.projectManager = dependencies.projectManager || projectManager;
    this.pinnedCharacterManager = dependencies.pinnedCharacterManager || pinnedCharacterManager;
    this.costumeManager = dependencies.costumeManager || costumeManager;
    this.positionManager = dependencies.positionManager || positionManager;
    this.motionManager = dependencies.motionManager || motionManager;
    this.expressionManager = dependencies.expressionManager || expressionManager;
    this.selectionManager = dependencies.selectionManager || selectionManager;
  }

  // ==================== 状态管理 ====================

  /**
   * 获取当前项目状态
   */
  getProjectState() {
    return this.state.get("projectFile");
  }

  /**
   * 设置项目状态
   */
  setProjectState(newState) {
    this.state.set("projectFile", newState);
  }

  /**
   * 获取当前配置
   */
  getCurrentConfig() {
    return this.state.get("currentConfig");
  }

  // ==================== 角色配置 ====================

  /**
   * 更新角色头像
   */
  updateCharacterAvatar(container, characterId, characterName) {
    return this.configManager.updateConfigAvatar(
      container,
      characterId,
      characterName
    );
  }

  /**
   * 根据 ID 获取角色名称
   */
  getCharacterNameById(characterId) {
    return this.configManager.getCharacterNameById(characterId);
  }

  /**
   * 根据名称获取角色 ID
   */
  getCharacterIdByName(characterName) {
    return this.configManager.getCharacterIdByName(characterName);
  }

  /**
   * 获取所有角色配置
   */
  getAllCharacters() {
    const config = this.getCurrentConfig();
    return Object.entries(config);
  }

  // ==================== 固定角色管理 ====================

  /**
   * 获取固定的角色列表
   */
  getPinnedCharacters() {
    return this.pinnedCharacterManager.getPinned();
  }

  /**
   * 切换角色固定状态
   */
  togglePinCharacter(characterName) {
    return this.pinnedCharacterManager.togglePin(characterName);
  }

  // ==================== 服装管理 ====================

  /**
   * 获取角色的服装列表
   */
  getCharacterCostumes(characterId) {
    return this.costumeManager.getCharacterCostumes?.(characterId) || [];
  }

  /**
   * 更新服装配置
   */
  updateCostumeConfig(characterName, costumeId) {
    return this.costumeManager.updateCostumeConfig?.(characterName, costumeId);
  }

  // ==================== 位置管理 ====================

  /**
   * 获取位置预设
   */
  getPositionPresets() {
    return this.positionManager.getPresets?.() || [];
  }

  /**
   * 验证位置数据
   */
  validatePosition(position) {
    return this.positionManager.validatePosition?.(position);
  }

  // ==================== 动作/表情管理 ====================

  /**
   * 获取动作列表
   */
  getMotions() {
    return this.motionManager?.getItems?.() || [];
  }

  /**
   * 获取表情列表
   */
  getExpressions() {
    return this.expressionManager?.getItems?.() || [];
  }

  /**
   * 添加动作
   */
  addMotion(motionName) {
    return this.motionManager?.addItem?.(motionName);
  }

  /**
   * 添加表情
   */
  addExpression(expressionName) {
    return this.expressionManager?.addItem?.(expressionName);
  }

  /**
   * 删除动作
   */
  removeMotion(motionName) {
    return this.motionManager?.removeItem?.(motionName);
  }

  /**
   * 删除表情
   */
  removeExpression(expressionName) {
    return this.expressionManager?.removeItem?.(expressionName);
  }

  // ==================== 选择管理 ====================

  /**
   * 清除选择
   */
  clearSelection() {
    return this.selectionManager?.clear?.();
  }

  /**
   * 附加选择管理器
   */
  attachSelection(element) {
    return this.selectionManager?.attach?.(element);
  }

  /**
   * 分离选择管理器
   */
  detachSelection(element) {
    return this.selectionManager?.detach?.(element);
  }

  /**
   * 标记项目为已修改
   */
  markProjectDirty() {
    return this.projectManager.markDirty?.();
  }

  /**
   * 保存项目
   */
  saveProject() {
    return this.projectManager.save?.();
  }

  // ==================== 历史记录（已通过 BaseEditor 处理）====================
  // historyManager 已经通过 BaseEditor 集成，编辑器不需要直接访问
}

// 创建单例
export const editorService = new EditorService();

// 导出类用于测试
export { EditorService };
