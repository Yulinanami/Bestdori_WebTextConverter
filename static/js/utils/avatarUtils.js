// 处理角色头像显示
import { state } from "@managers/stateManager.js";
import { DOMUtils } from "@utils/DOMUtils.js";

// 找头像节点
function findAvatarEl(target) {
  if (!target) {
    return null;
  }

  if (
    target.classList?.contains("config-avatar") ||
    target.classList?.contains("dialogue-avatar")
  ) {
    return target;
  }

  return target.querySelector?.(".config-avatar, .dialogue-avatar") || null;
}

// 取映射后的头像 id
export function mapAvatarId(characterId) {
  const avatarMapping = state.avatarMapping || {};
  return (
    avatarMapping[characterId] ??
    avatarMapping[String(characterId)] ??
    characterId
  );
}

// 渲染角色头像
export function renderAvatar(target, characterId, name = "") {
  const avatarElement = findAvatarEl(target);
  if (!avatarElement) {
    return;
  }

  const avatarId = mapAvatarId(characterId);
  const fallbackText = String(name || "?").charAt(0) || "?";

  avatarElement.className = "config-avatar";
  avatarElement.dataset.id = String(characterId ?? "");
  DOMUtils.clearElement(avatarElement);

  if ((avatarId ?? 0) > 0) {
    avatarElement.classList.remove("fallback");

    const avatarImage = DOMUtils.createElement("img", {
      src: `/static/images/avatars/${avatarId}.png`,
      alt: name || fallbackText,
      className: "config-avatar-img",
      loading: "lazy",
    });

    avatarImage.addEventListener("error", () => {
      DOMUtils.clearElement(avatarElement);
      avatarElement.textContent = fallbackText;
      avatarElement.classList.add("fallback");
    });

    avatarElement.appendChild(avatarImage);
    return;
  }

  avatarElement.textContent = fallbackText;
  avatarElement.classList.add("fallback");
}
