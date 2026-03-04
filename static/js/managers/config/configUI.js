import { DOMUtils } from "@utils/DOMUtils.js";
import { DataUtils } from "@utils/DataUtils.js";
import { state } from "@managers/stateManager.js";

// 配置 UI 层
export const configUI = {
  // 绑定配置列表的删除按钮、输入变化等事件
  bindConfigListInteractions(configManager) {
    const configList = document.getElementById("configList");
    if (configList) {
      configList.addEventListener("click", (clickEvent) => {
        const removeButton = clickEvent.target.closest(".remove-btn");
        if (removeButton) {
          removeButton.closest(".config-item").remove();
        }
      });

      configList.addEventListener("input", (inputEvent) => {
        const configItem = inputEvent.target.closest(".config-item");
        if (!configItem) return;
        const avatarWrapper = configItem.querySelector(
          ".config-avatar-wrapper",
        );

        const nameInput = configItem.querySelector(".config-name");
        const characterName = nameInput.value || "?";

        if (inputEvent.target.classList.contains("config-ids")) {
          const updatedCharacterIds = inputEvent.target.value
            .split(",")
            .map((id) => parseInt(id.trim()))
            .filter((id) => !isNaN(id));
          const updatedPrimaryId =
            updatedCharacterIds.length > 0 ? updatedCharacterIds[0] : 0;
          this.updateConfigAvatar(
            configManager,
            avatarWrapper,
            updatedPrimaryId,
            characterName,
          );
        } else if (inputEvent.target.classList.contains("config-name")) {
          const avatar = avatarWrapper.querySelector(".config-avatar");
          if (avatar.classList.contains("fallback")) {
            avatar.innerHTML = inputEvent.target.value.charAt(0) || "?";
          }
        }
      });
    }
  },

  // 把配置按角色 ID 排序后渲染到页面
  renderConfigList(configManager) {
    const sortedConfig = DataUtils.sortBy(
      Object.entries(state.get("currentConfig")),
      ([, ids]) => ids?.[0] ?? Infinity,
      "asc",
    );
    this.renderNormalConfigList(configManager, sortedConfig);
  },

  // 按给定的数据渲染列表（使用 template 克隆 DOM）
  renderNormalConfigList(configManager, sortedConfig) {
    const configList = document.getElementById("configList");
    const template = document.getElementById("config-item-template");
    if (!configList || !template) return;

    const configItems = sortedConfig.map(([name, ids]) => {
      const clone = template.content.cloneNode(true);
      const configItem = clone.querySelector(".config-item");
      const primaryId = ids?.[0] ?? 0;
      const avatarWrapper = configItem.querySelector(".config-avatar-wrapper");
      this.updateConfigAvatar(configManager, avatarWrapper, primaryId, name);

      configItem.querySelector(".config-name").value = name;
      configItem.querySelector(".config-ids").value = Array.isArray(ids)
        ? ids.join(",")
        : ids;

      return configItem;
    });

    DOMUtils.clearElement(configList);
    DOMUtils.appendChildren(configList, configItems);
  },

  // 更新某一行的头像显示（图片加载失败就用首字母兜底）
  updateConfigAvatar(configManager, avatarWrapper, id, name) {
    const avatar = avatarWrapper.querySelector(".config-avatar");
    avatar.dataset.id = id;
    const avatarId = configManager.getAvatarId(id);
    const fallbackText = name.charAt(0);

    DOMUtils.clearElement(avatar);

    if (avatarId > 0) {
      avatar.className = "config-avatar";

      const img = DOMUtils.createElement("img", {
        src: `/static/images/avatars/${avatarId}.png`,
        alt: name,
        className: "config-avatar-img",
        loading: "lazy",
      });

      img.addEventListener("error", () => {
        DOMUtils.clearElement(avatar);
        avatar.textContent = fallbackText;
        avatar.classList.add("fallback");
      });

      avatar.appendChild(img);
    } else {
      avatar.className = "config-avatar fallback";
      avatar.textContent = fallbackText;
    }
  },

  // 在列表最上面插入一个空白配置项（方便用户新增角色）
  addConfigItem() {
    const configList = document.getElementById("configList");
    const template = document.getElementById("config-item-template");
    const clone = template.content.cloneNode(true);
    const configItem = clone.querySelector(".config-item");
    const avatar = configItem.querySelector(".config-avatar");
    avatar.classList.add("fallback");
    avatar.dataset.id = "0";
    avatar.textContent = "?";
    configList.prepend(configItem);
  },
};
