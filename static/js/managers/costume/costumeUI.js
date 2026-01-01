import { costumeInteractions } from "@managers/costume/costumeInteractions.js";
import { costumeRenderer } from "@managers/costume/costumeRenderer.js";

// 服装 UI 的对外入口：把渲染和交互两个模块统一转发出去
export const costumeUI = {
  // 绑定列表交互事件（点击、下拉框 change 等）
  bindCostumeListEvents(manager) {
    costumeInteractions.bindCostumeListEvents(manager);
  },

  // 渲染整个服装列表
  renderCostumeList(manager) {
    costumeRenderer.renderCostumeList(manager);
  },

  // 打开外部 Live2D 数据库页面
  openLive2DDatabase() {
    costumeInteractions.openLive2DDatabase();
  },

  // 渲染某个角色的服装条目（返回 HTML 字符串）
  renderCostumeListItems(characterKey, costumes, safeDomId) {
    return costumeRenderer.renderCostumeListItems(
      characterKey,
      costumes,
      safeDomId
    );
  },

  // 展开/收起某个角色的详情面板
  toggleCostumeDetails(safeDomId) {
    costumeInteractions.toggleCostumeDetails(safeDomId);
  },

  // 弹窗输入并添加服装 ID
  addNewCostume(manager, characterKey, safeDomId) {
    return costumeInteractions.addNewCostume(
      manager,
      characterKey,
      safeDomId
    );
  },

  // 弹窗输入并编辑服装 ID
  editCostume(manager, characterKey, index, oldCostume, safeDomId) {
    return costumeInteractions.editCostume(
      manager,
      characterKey,
      index,
      oldCostume,
      safeDomId
    );
  },

  // 删除某个服装 ID
  deleteCostume(manager, characterKey, index, safeDomId) {
    return costumeInteractions.deleteCostume(
      manager,
      characterKey,
      index,
      safeDomId
    );
  },

  // 更新某个角色的局部 UI（列表 + select）
  updateCostumeListUI(manager, characterKey, safeDomId) {
    costumeRenderer.updateCostumeListUI(manager, characterKey, safeDomId);
  },
};
