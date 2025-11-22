// 角色列表渲染 Mixin
// 提供角色列表的渲染和置顶功能

import { DOMUtils } from "@utils/DOMUtils.js";
import { editorService } from "@services/EditorService.js";

export const CharacterListMixin = {
  /**
   * 渲染角色列表
   * @param {Set<string>} usedCharacterNames - 已使用的角色名称集合（用于高亮显示）
   */
  renderCharacterList(usedCharacterNames) {
    const listContainer = document.getElementById(this.characterListId);
    if (!listContainer) return;

    const template = document.getElementById("draggable-character-template");
    if (!template) return;

    DOMUtils.clearElement(listContainer);
    const fragment = document.createDocumentFragment();
    const characters = editorService.getAllCharacters();
    const pinned = editorService.getPinnedCharacters();

    // 排序：置顶角色优先，然后按ID排序
    characters.sort(([nameA, idsA], [nameB, idsB]) => {
      const isAPinned = pinned.has(nameA);
      const isBPinned = pinned.has(nameB);
      if (isAPinned && !isBPinned) return -1;
      if (!isAPinned && isBPinned) return 1;
      return idsA[0] - idsB[0];
    });

    // 渲染角色项
    characters.forEach(([name, ids]) => {
      const item = template.content.cloneNode(true);
      const characterItem = item.querySelector(".character-item");
      const characterId = ids[0];
      characterItem.dataset.characterId = characterId;
      characterItem.dataset.characterName = name;

      // 标记已使用的角色
      if (usedCharacterNames && usedCharacterNames.has(name)) {
        characterItem.classList.add("is-used");
      }

      // 更新角色头像
      const avatarWrapper = { querySelector: (sel) => item.querySelector(sel) };
      editorService.updateCharacterAvatar(avatarWrapper, characterId, name);
      item.querySelector(".character-name").textContent = name;

      // 设置置顶按钮状态
      const pinBtn = item.querySelector(".pin-btn");
      if (pinned.has(name)) {
        pinBtn.classList.add("is-pinned");
      }

      fragment.appendChild(item);
    });

    listContainer.appendChild(fragment);
  },

  /**
   * 初始化置顶按钮的事件处理
   */
  initPinButtonHandler() {
    const characterList = document.getElementById(this.characterListId);
    if (!characterList) return;

    characterList.addEventListener("click", (e) => {
      const pinBtn = e.target.closest(".pin-btn");
      if (pinBtn) {
        e.stopPropagation();
        e.preventDefault();
        const characterItem = pinBtn.closest(".character-item");
        if (characterItem && characterItem.dataset.characterName) {
          const characterName = characterItem.dataset.characterName;
          editorService.togglePinCharacter(characterName);

          // 调用子类的后处理钩子
          if (this.afterPinToggle) {
            this.afterPinToggle();
          }
        }
      }
    });
  },
};
