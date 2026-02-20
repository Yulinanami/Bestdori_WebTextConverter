// 管理服装配置页面：加载默认/本地服装、渲染 UI、保存/重置/导入
import { modalService } from "@services/ModalService.js";
import { DataUtils } from "@utils/DataUtils.js";
import { ui } from "@utils/uiUtils.js";
import { state } from "@managers/stateManager.js";
import { FileUtils } from "@utils/FileUtils.js";
import { costumeUI } from "@managers/costume/costumeUI.js";
import { costumeData } from "@managers/costume/costumeData.js";

export const costumeManager = {
  defaultCostumes: {},
  defaultAvailableCostumes: {},
  availableCostumes: {},
  builtInCharacters: new Set(),
  mujicaMapping: {},

  // 模态框内的临时状态
  tempCostumeChanges: {},
  tempAvailableCostumes: {},

  // 初始化：绑定服装列表上的点击/选择事件
  init() {
    costumeUI.bindCostumeListEvents(this);
  },

  // 把角色名转成“内部使用的 key”（目前就直接用角色名）
  getCharacterKey(characterName) {
    return characterName;
  },

  // 把角色名转成“安全的 DOM id”（用于 querySelector/id）
  getSafeDomId(characterName) {
    return characterName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_");
  },

  // 把“按角色ID存”的可用服装表，转换成“按角色名 key 存”
  convertAvailableCostumesToNameBased() {
    return costumeData.convertAvailableCostumesToNameBased(this);
  },

  // 把“按角色ID存”的默认服装表，转换成“按角色名 key 存”
  convertDefaultCostumesToNameBased() {
    return costumeData.convertDefaultCostumesToNameBased(this);
  },

  // 从后端读取默认服装配置，并与本地配置合并
  async loadCostumeConfig() {
    return costumeData.loadCostumeConfig(this);
  },

  // 从本地读取“当前服装选择”
  loadLocalCostumes() {
    return costumeData.loadLocalCostumes();
  },

  // 保存“当前服装选择”到本地
  saveLocalCostumes(costumes) {
    return costumeData.saveLocalCostumes(costumes);
  },

  // 从本地读取“可用服装列表”
  loadLocalAvailableCostumes() {
    return costumeData.loadLocalAvailableCostumes();
  },

  // 保存“可用服装列表”到本地
  saveLocalAvailableCostumes() {
    return costumeData.saveLocalAvailableCostumes(this);
  },

  // 渲染整个服装列表（每个角色一块）
  renderCostumeList() {
    costumeUI.renderCostumeList(this);
  },

  // 打开 Bestdori Live2D 数据库页面（新标签页）
  openLive2DDatabase() {
    costumeUI.openLive2DDatabase();
  },

  // 渲染某个角色的“服装列表项”HTML（用于更新局部 UI）
  renderCostumeListItems(characterKey, costumes, safeDomId) {
    return costumeUI.renderCostumeListItems(characterKey, costumes, safeDomId);
  },

  // 展开/收起某个角色的“服装管理详情”面板
  toggleCostumeDetails(safeDomId) {
    costumeUI.toggleCostumeDetails(safeDomId);
  },

  // 添加一个新的服装 ID 到临时列表
  addNewCostume(characterKey, safeDomId) {
    return costumeUI.addNewCostume(this, characterKey, safeDomId);
  },

  // 编辑临时列表中的某个服装 ID
  editCostume(characterKey, index, oldCostume, safeDomId) {
    return costumeUI.editCostume(
      this,
      characterKey,
      index,
      oldCostume,
      safeDomId,
    );
  },

  // 从临时列表删除一个服装 ID
  deleteCostume(characterKey, index, safeDomId) {
    return costumeUI.deleteCostume(this, characterKey, index, safeDomId);
  },

  // 刷新某个角色的局部 UI（列表 + 下拉框选项）
  updateCostumeListUI(characterKey, safeDomId) {
    costumeUI.updateCostumeListUI(this, characterKey, safeDomId);
  },

  // 保存临时更改：写入 state + localStorage
  async saveCostumes() {
    await ui.withButtonLoading(
      "saveCostumesBtn",
      async () => {
        state.set(
          "currentCostumes",
          DataUtils.deepClone(this.tempCostumeChanges),
        );

        this.availableCostumes = DataUtils.deepClone(
          this.tempAvailableCostumes,
        );

        this.saveLocalCostumes(state.get("currentCostumes"));
        this.saveLocalAvailableCostumes();

        await FileUtils.delay(300);
        ui.showStatus("服装配置已保存！", "success");
      },
      "保存中...",
    );
  },

  // 重置为默认服装（内置角色重置，自定义角色保留）
  async resetCostumes() {
    const confirmed = await modalService.confirm(
      "确定要恢复默认服装配置吗？这将只重置内置角色的服装设置，自定义角色的服装配置将保留。",
    );

    if (confirmed) {
      await ui.withButtonLoading(
        "resetCostumesBtn",
        async () => {
          await FileUtils.delay(300);
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
        "恢复中...",
      );
    }
  },

  // 导入配置时：把导入的服装相关字段应用到当前状态
  importCostumes(config) {
    costumeData.importCostumes(this, config);
  },
};
