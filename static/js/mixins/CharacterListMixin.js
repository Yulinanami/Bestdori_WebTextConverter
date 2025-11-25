// 角色列表渲染 Mixin
// 提供角色列表的渲染和置顶功能

import { DOMUtils } from "@utils/DOMUtils.js";
import { DataUtils } from "@utils/DataUtils.js";
import { editorService } from "@services/EditorService.js";

function createCharacterListCache() {
  return {
    nodesByName: new Map(),
    signatures: new Map(),
    contextSignature: "",
  };
}

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

    const cache =
      this._characterListCache || (this._characterListCache = createCharacterListCache());
    const fragment = document.createDocumentFragment();
    const characters = editorService.getAllCharacters();
    const pinned = editorService.getPinnedCharacters();

    // 计算上下文签名（角色配置 + 置顶列表），发生变化时强制更新签名缓存
    const configSignature = DataUtils.shallowSignature(
      characters.reduce((acc, [name, ids]) => {
        acc[name] = ids;
        return acc;
      }, {})
    );
    const pinnedSignature = JSON.stringify(Array.from(pinned).sort());
    const contextSignature = `${configSignature}|${pinnedSignature}`;
    if (cache.contextSignature !== contextSignature) {
      cache.signatures.clear();
      cache.contextSignature = contextSignature;
    }

    // 排序：置顶角色优先，然后按ID排序
    characters.sort(([nameA, idsA], [nameB, idsB]) => {
      const isAPinned = pinned.has(nameA);
      const isBPinned = pinned.has(nameB);
      if (isAPinned && !isBPinned) return -1;
      if (!isAPinned && isBPinned) return 1;
      return idsA[0] - idsB[0];
    });

    const validNames = new Set();

    // 渲染角色项
    characters.forEach(([name, ids]) => {
      const characterId = ids[0];
      const isPinned = pinned.has(name);
      const isUsed = usedCharacterNames && usedCharacterNames.has(name);
      const signature = `${characterId}|${isPinned ? 1 : 0}|${isUsed ? 1 : 0}`;
      validNames.add(name);

      const cachedSignature = cache.signatures.get(name);
      let card = cache.nodesByName.get(name);
      const needsUpdate = !card || cachedSignature !== signature;

      if (!card) {
        const instance = template.content.cloneNode(true);
        card = instance.querySelector(".character-item") || instance.firstElementChild;
      }

      if (card) {
        // 复位可能由拖拽留下的状态，避免被隐藏或异常样式
        card.style.display = "";
        card.classList.remove("sortable-ghost", "sortable-chosen", "sortable-drag");
      }

      if (needsUpdate && card) {
        card.dataset.characterId = characterId;
        card.dataset.characterName = name;
        card.classList.toggle("is-used", !!isUsed);

        const pinBtn = card.querySelector(".pin-btn");
        if (pinBtn) {
          pinBtn.classList.toggle("is-pinned", isPinned);
        }

        editorService.updateCharacterAvatar(card, characterId, name);
        const nameEl = card.querySelector(".character-name");
        if (nameEl) nameEl.textContent = name;

        cache.signatures.set(name, signature);
        cache.nodesByName.set(name, card);
      }

      if (card) {
        fragment.appendChild(card);
      }
    });

    // 清理无效缓存节点
    for (const cachedName of Array.from(cache.nodesByName.keys())) {
      if (!validNames.has(cachedName)) {
        cache.nodesByName.delete(cachedName);
        cache.signatures.delete(cachedName);
      }
    }

    listContainer.replaceChildren(fragment);
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
