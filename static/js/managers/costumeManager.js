// 服装管理相关功能
import { modalService } from "../services/ModalService.js";
import { DataUtils } from "../utils/DataUtils.js";
import { ui } from "../utils/uiUtils.js";
import { state } from "./stateManager.js";
import { costumeUI } from "./costumeUI.js";
import { costumeData } from "./costumeData.js";

export const costumeManager = {
  defaultCostumes: {},
  defaultAvailableCostumes: {},
  availableCostumes: {},
  builtInCharacters: new Set(),
  mujicaMapping: {},

  // 模态框内的临时状态
  tempCostumeChanges: {},
  tempAvailableCostumes: {},

  init() {
    costumeUI.bindCostumeListEvents(this);
  },

  // 生成角色的唯一标识符（使用角色名称）
  getCharacterKey(characterName) {
    return characterName;
  },

  getSafeDomId(characterName) {
    return characterName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_");
  },

  convertAvailableCostumesToNameBased() {
    return costumeData.convertAvailableCostumesToNameBased(this);
  },

  convertDefaultCostumesToNameBased() {
    return costumeData.convertDefaultCostumesToNameBased(this);
  },

  async loadCostumeConfig() {
    return costumeData.loadCostumeConfig(this);
  },

  loadLocalCostumes() {
    return costumeData.loadLocalCostumes();
  },

  saveLocalCostumes(costumes) {
    return costumeData.saveLocalCostumes(costumes);
  },

  loadLocalAvailableCostumes() {
    return costumeData.loadLocalAvailableCostumes();
  },

  saveLocalAvailableCostumes() {
    return costumeData.saveLocalAvailableCostumes(this);
  },

  renderCostumeList() {
    costumeUI.renderCostumeList(this);
  },

  openLive2DDatabase() {
    costumeUI.openLive2DDatabase();
  },

  renderCostumeListItems(characterKey, costumes, safeDomId) {
    return costumeUI.renderCostumeListItems(characterKey, costumes, safeDomId);
  },

  toggleCostumeDetails(safeDomId) {
    costumeUI.toggleCostumeDetails(safeDomId);
  },

  addNewCostume(characterKey, safeDomId) {
    return costumeUI.addNewCostume(this, characterKey, safeDomId);
  },

  editCostume(characterKey, index, oldCostume, safeDomId) {
    return costumeUI.editCostume(
      this,
      characterKey,
      index,
      oldCostume,
      safeDomId
    );
  },

  deleteCostume(characterKey, index, safeDomId) {
    return costumeUI.deleteCostume(this, characterKey, index, safeDomId);
  },

  updateCostumeListUI(characterKey, safeDomId) {
    costumeUI.updateCostumeListUI(this, characterKey, safeDomId);
  },

  // 保存所有临时更改
  async saveCostumes() {
    await ui.withButtonLoading(
      "saveCostumesBtn",
      async () => {
        state.set(
          "currentCostumes",
          DataUtils.deepClone(this.tempCostumeChanges)
        );

        this.availableCostumes = DataUtils.deepClone(
          this.tempAvailableCostumes
        );

        this.saveLocalCostumes(state.get("currentCostumes"));
        this.saveLocalAvailableCostumes();

        await new Promise((resolve) => setTimeout(resolve, 300));
        ui.showStatus("服装配置已保存！", "success");
      },
      "保存中..."
    );
  },

  // 重置为默认服装
  async resetCostumes() {
    const confirmed = await modalService.confirm(
      "确定要恢复默认服装配置吗？这将只重置内置角色的服装设置，自定义角色的服装配置将保留。"
    );

    if (confirmed) {
      await ui.withButtonLoading(
        "resetCostumesBtn",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const customCharacterCostumes = {};
          const customCharacterAvailableCostumes = {};
          Object.entries(state.get("currentConfig")).forEach(([name, _ids]) => {
            if (!this.builtInCharacters.has(name)) {
              const characterKey = this.getCharacterKey(name);

              if (this.tempCostumeChanges[characterKey] !== undefined) {
                customCharacterCostumes[characterKey] =
                  this.tempCostumeChanges[characterKey];
              }

              if (this.tempAvailableCostumes[characterKey]) {
                customCharacterAvailableCostumes[characterKey] = [
                  ...this.tempAvailableCostumes[characterKey],
                ];
              }
            }
          });

          const defaultCostumesNameBased =
            this.convertDefaultCostumesToNameBased();
          const defaultAvailableCostumesNameBased =
            this.convertAvailableCostumesToNameBased();
          this.tempCostumeChanges = {
            ...defaultCostumesNameBased,
            ...customCharacterCostumes,
          };
          this.tempAvailableCostumes = {
            ...defaultAvailableCostumesNameBased,
            ...customCharacterAvailableCostumes,
          };
          this.renderCostumeList();
          ui.showStatus("已在编辑器中恢复默认，请保存以生效", "info");
        },
        "恢复中..."
      );
    }
  },

  // 导入配置时处理服装配置
  importCostumes(config) {
    costumeData.importCostumes(this, config);
  },
};
