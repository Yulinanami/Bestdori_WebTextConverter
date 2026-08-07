// 角色配置渲染界面管理（拆分自原角色配置管理器）
import { DataUtils } from "@utils/DataUtils.js";
import { renderAvatar } from "@utils/avatarUtils.js";
import { state } from "@managers/stateManager.js";
import { ui } from "@utils/uiUtils.js";
import { modalService } from "@services/ModalService.js";
import { FileUtils } from "@utils/FileUtils.js";

export const configView = {
  manager: null,

  // 初始化配置页并绑定事件
  init(manager) {
    this.manager = manager;
    this.bindConfigListEvents();
    this.bindActionButtons();
  },

  // 绑定配置列表里的事件
  bindConfigListEvents() {
    const configList = document.getElementById("configList");
    if (!configList) return;

    // 点删除按钮时删掉一项
    configList.addEventListener("click", async (clickEvent) => {
      const removeButton = clickEvent.target.closest(".remove-btn");
      if (removeButton) {
        const configItem = removeButton.closest(".config-item");
        const characterName =
          configItem?.querySelector(".config-name")?.value.trim() || "未命名角色";
        const confirmed = await modalService.confirm(
          `确定要删除角色“${characterName}”吗？`,
        );
        if (confirmed) configItem?.remove();
      }
    });

    // 输入变化时刷新头像
    configList.addEventListener("input", (inputEvent) => {
      const configItem = inputEvent.target.closest(".config-item");
      if (!configItem) {
        return;
      }
      this.updateConfigAvatar(configItem);
    });
  },

  // 绑定页面按钮
  bindActionButtons() {
    [
      ["addConfigBtn", () => this.addConfigItem()],
      ["saveConfigBtn", () => this.saveConfig()],
      ["resetConfigBtn", () => this.resetConfig()],
      ["exportConfigBtn", () => this.manager.exportConfig()],
      ["clearCacheBtn", () => this.clearLocalStorage()],
    ].forEach(([buttonId, handler]) => {
      document.getElementById(buttonId)?.addEventListener("click", handler);
    });

    const importInput = document.getElementById("importConfigInput");
    // 点导入按钮时打开文件选择
    document
      .getElementById("importConfigBtn")
      ?.addEventListener("click", () => importInput?.click());
    // 选中文件后开始导入
    importInput?.addEventListener("change", (changeEvent) => {
      const file = changeEvent.target.files[0];
      if (!file) {
        return;
      }
      this.manager.importConfig(file);
      changeEvent.target.value = "";
    });
  },

  // 渲染角色列表
  renderConfigList() {
    const configList = document.getElementById("configList");
    if (!configList) return;

    // 按每组的第一个角色 id 排序 让列表顺序稳定
    const sortedEntries = DataUtils.sortBy(
      Object.entries(state.currentConfig),
      ([, ids]) => ids?.[0] ?? Number.POSITIVE_INFINITY,
      "asc",
    );
    configList.replaceChildren(
      ...sortedEntries.map(([name, ids]) =>
        this.createConfigItem(name, ids),
      ),
    );
  },

  // 新增一项空配置
  addConfigItem() {
    const configList = document.getElementById("configList");
    configList?.prepend(this.createConfigItem());
  },

  // 创建一项角色配置
  createConfigItem(characterName = "", characterIds = []) {
    const template = document.getElementById("config-item-template");
    const clone = template.content.cloneNode(true);
    const configItem = clone.querySelector(".config-item");
    configItem.querySelector(".config-name").value = characterName;
    configItem.querySelector(".config-ids").value = characterIds.join(",");
    this.updateConfigAvatar(configItem);
    return configItem;
  },

  // 刷新一项里的头像
  updateConfigAvatar(configItem) {
    const avatarWrapper = configItem.querySelector(".config-avatar-wrapper");
    const characterName = configItem.querySelector(".config-name").value || "?";
    const characterIdsText = configItem.querySelector(".config-ids").value;
    const characterIds = this.manager.parseCharacterIds(characterIdsText);
    const primaryId = characterIds[0] || 0;

    renderAvatar(avatarWrapper, primaryId, characterName);
    const avatar = avatarWrapper.querySelector(".config-avatar");
    if (avatar && avatar.classList.contains("fallback")) {
      avatar.textContent = characterName.charAt(0) || "?";
    }
  },

  // 读取页面上的配置
  collectConfigList() {
    const nextConfig = {};
    document.querySelectorAll(".config-item").forEach((configItem) => {
      const characterName = configItem.querySelector(".config-name").value.trim();
      const characterIdsText = configItem.querySelector(".config-ids").value.trim();
      if (!characterName || !characterIdsText) {
        return;
      }

      const characterIds = this.manager.parseCharacterIds(characterIdsText);
      if (characterIds.length > 0) {
        nextConfig[characterName] = characterIds;
      }
    });
    return nextConfig;
  },

  // 保存配置UI交互
  async saveConfig() {
    if (!this.manager) return;
    await ui.withButtonLoading(
      "saveConfigBtn",
      async () => {
        const newConfig = this.collectConfigList();
        await FileUtils.delay(500);
        await this.manager.saveConfigData(newConfig);
      },
      "保存中...",
    );
  },

  // 恢复默认配置UI交互
  async resetConfig() {
    if (!this.manager) return;
    const confirmed = await modalService.confirm(
      "【警告】此操作将恢复为系统默认角色列表。\n\n所有自定义添加的角色及其服装配置都将被删除。\n\n确定要继续吗？",
    );
    if (!confirmed) {
      return;
    }

    await ui.withButtonLoading(
      "resetConfigBtn",
      async () => {
        await FileUtils.delay(300);
        await this.manager.resetConfigData();
      },
      "重置中...",
    );
  },

  // 清空本地缓存UI交互
  async clearLocalStorage() {
    if (!this.manager) return;
    const confirmed = await modalService.confirm(
      "【警告】此操作将删除所有本地保存的用户数据，包括：\n\n" +
        "  - 自定义角色映射\n" +
        "  - 所有角色的服装配置\n" +
        "  - 引号选项状态（预设和自定义）\n" +
        "  - 自定义动作和表情\n" +
        "  - 自动添加空格的配置\n" +
        "  - Live2D 布局和位置设置\n" +
        "  - 编辑器偏好设置\n\n" +
        "网页将恢复到初始默认状态。此操作无法撤销，确定要继续吗？",
    );
    if (!confirmed) {
      return;
    }

    await ui.withButtonLoading(
      "clearCacheBtn",
      async () => {
        await FileUtils.delay(500);
        await this.manager.clearAllCache();
      },
      "清除中...",
    );
  },
};
