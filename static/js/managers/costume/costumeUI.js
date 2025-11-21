import { costumeInteractions } from "./costumeInteractions.js";
import { costumeRenderer } from "./costumeRenderer.js";

/**
 * 服装管理 UI 的聚合出口，统一暴露外部使用的接口。
 */
export const costumeUI = {
  bindCostumeListEvents(manager) {
    costumeInteractions.bindCostumeListEvents(manager);
  },

  renderCostumeList(manager) {
    costumeRenderer.renderCostumeList(manager);
  },

  openLive2DDatabase() {
    costumeInteractions.openLive2DDatabase();
  },

  renderCostumeListItems(characterKey, costumes, safeDomId) {
    return costumeRenderer.renderCostumeListItems(
      characterKey,
      costumes,
      safeDomId
    );
  },

  toggleCostumeDetails(safeDomId) {
    costumeInteractions.toggleCostumeDetails(safeDomId);
  },

  addNewCostume(manager, characterKey, safeDomId) {
    return costumeInteractions.addNewCostume(
      manager,
      characterKey,
      safeDomId
    );
  },

  editCostume(manager, characterKey, index, oldCostume, safeDomId) {
    return costumeInteractions.editCostume(
      manager,
      characterKey,
      index,
      oldCostume,
      safeDomId
    );
  },

  deleteCostume(manager, characterKey, index, safeDomId) {
    return costumeInteractions.deleteCostume(
      manager,
      characterKey,
      index,
      safeDomId
    );
  },

  updateCostumeListUI(manager, characterKey, safeDomId) {
    costumeRenderer.updateCostumeListUI(manager, characterKey, safeDomId);
  },
};
