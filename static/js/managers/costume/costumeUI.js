import { costumeInteractions } from "@managers/costume/costumeInteractions.js";
import { costumeRenderer } from "@managers/costume/costumeRenderer.js";

// 服装 UI 的对外入口：把渲染和交互两个模块统一转发出去
export const costumeUI = {
  // 绑定列表交互事件（点击、下拉框 change 等）
  bindCostumeListEvents(costumeManager) {
    costumeInteractions.bindCostumeListEvents(costumeManager);
  },

  // 渲染整个服装列表
  renderCostumeList(costumeManager) {
    costumeRenderer.renderCostumeList(costumeManager);
  },

  // 打开外部 Live2D 数据库页面
  openLive2DDatabase() {
    costumeInteractions.openLive2DDatabase();
  },

  // 渲染某个角色的服装条目（返回 HTML 字符串）
  renderCostumeListItems(characterName, costumeIds, safeDomId) {
    return costumeRenderer.renderCostumeListItems(
      characterName,
      costumeIds,
      safeDomId
    );
  },

  // 展开/收起某个角色的详情面板
  toggleCostumeDetails(safeDomId) {
    costumeInteractions.toggleCostumeDetails(safeDomId);
  },

  // 弹窗输入并添加服装 ID
  addNewCostume(costumeManager, characterName, safeDomId) {
    return costumeInteractions.addNewCostume(
      costumeManager,
      characterName,
      safeDomId
    );
  },

  // 弹窗输入并编辑服装 ID
  editCostume(costumeManager, characterName, index, oldCostumeId, safeDomId) {
    return costumeInteractions.editCostume(
      costumeManager,
      characterName,
      index,
      oldCostumeId,
      safeDomId
    );
  },

  // 删除某个服装 ID
  deleteCostume(costumeManager, characterName, index, safeDomId) {
    return costumeInteractions.deleteCostume(
      costumeManager,
      characterName,
      index,
      safeDomId
    );
  },

  // 更新某个角色的局部 UI（列表 + select）
  updateCostumeListUI(costumeManager, characterName, safeDomId) {
    costumeRenderer.updateCostumeListUI(
      costumeManager,
      characterName,
      safeDomId
    );
  },
};
