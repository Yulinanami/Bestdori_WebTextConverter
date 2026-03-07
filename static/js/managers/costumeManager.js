// 管理服装配置页面：加载默认/本地服装、渲染 UI、保存/重置/导入
import { modalService } from "@services/ModalService.js";
import { DataUtils } from "@utils/DataUtils.js";
import { ui } from "@utils/uiUtils.js";
import { state } from "@managers/stateManager.js";
import { FileUtils } from "@utils/FileUtils.js";
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";
import { costumeRenderer } from "@managers/costume/costumeRenderer.js";
import { costumeData } from "@managers/costume/costumeData.js";

export const costumeManager = {
  defaultCostumes: {},
  defaultAvailableCostumes: {},
  availableCostumes: {},
  builtInCharacters: new Set(),

  // 模态框内的临时状态
  tempCostumeChanges: {},
  tempAvailableCostumes: {},

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

        storageService.set(
          STORAGE_KEYS.COSTUME_MAPPING_V2,
          state.get("currentCostumes"),
        );
        costumeData.saveLocalAvailableCostumes(this);

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
          Object.entries(state.get("currentConfig")).forEach(
            ([characterName]) => {
              if (!this.builtInCharacters.has(characterName)) {
                if (this.tempCostumeChanges[characterName] !== undefined) {
                  customCharacterCostumes[characterName] =
                    this.tempCostumeChanges[characterName];
                }

                if (this.tempAvailableCostumes[characterName]) {
                  customCharacterAvailableCostumes[characterName] = [
                    ...this.tempAvailableCostumes[characterName],
                  ];
                }
              }
            },
          );

          const defaultCostumesByName =
            costumeData.convertDefaultCostumesToNameBased(this);
          const defaultAvailableCostumesByName =
            costumeData.convertAvailableCostumesToNameBased(this);
          this.tempCostumeChanges = {
            ...defaultCostumesByName,
            ...customCharacterCostumes,
          };
          this.tempAvailableCostumes = {
            ...defaultAvailableCostumesByName,
            ...customCharacterAvailableCostumes,
          };
          costumeRenderer.renderCostumeList(this);
          ui.showStatus("已在编辑器中恢复默认，请保存以生效", "info");
        },
        "恢复中...",
      );
    }
  },
};
