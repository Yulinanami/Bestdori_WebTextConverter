// 处理编辑器右侧角色列表
import { DataUtils } from "@utils/DataUtils.js";
import { state } from "@managers/stateManager.js";
import { pinnedCharacterManager, pinnedCharacters } from "@managers/pinnedCharacterManager.js";
import { renderAvatar } from "@utils/avatarUtils.js";

// 创建角色列表缓存
function buildListCache() {
  return {
    nodesByName: new Map(),
    signatures: new Map(),
    contextSignature: "",
  };
}

const characterListMethods = {
  // 刷新角色列表
  renderCharacterList(usedCharacterNames) {
    const listContainer = document.getElementById(this.characterListId);
    if (!listContainer) {
      return;
    }

    const template = document.getElementById("draggable-character-template");
    if (!template) {
      return;
    }

    const cache =
      this._characterListCache ||
      (this._characterListCache = buildListCache());
    const fragment = document.createDocumentFragment();
    const characters = Object.entries(state.currentConfig || {});
    const pinned = pinnedCharacters;

    const configSignature = DataUtils.shallowSignature(
      characters.reduce((acc, [name, ids]) => {
        acc[name] = ids;
        return acc;
      }, {})
    );
    // 配置和置顶状态一起决定列表缓存是否失效
    const pinnedSignature = JSON.stringify(Array.from(pinned).sort());
    const contextSignature = `${configSignature}|${pinnedSignature}`;
    if (cache.contextSignature !== contextSignature) {
      cache.signatures.clear();
      cache.contextSignature = contextSignature;
    }

    // 置顶角色永远排前面 其余角色再按主 id 排
    characters.sort(([nameA, idsA], [nameB, idsB]) => {
      const isAPinned = pinned.has(nameA);
      const isBPinned = pinned.has(nameB);
      if (isAPinned && !isBPinned) {
        return -1;
      }
      if (!isAPinned && isBPinned) {
        return 1;
      }
      return idsA[0] - idsB[0];
    });

    const validNames = new Set();
    characters.forEach(([name, ids]) => {
      const characterId = ids[0];
      const isPinned = pinned.has(name);
      const isUsed = usedCharacterNames && usedCharacterNames.has(name);
      const signature = `${characterId}|${isPinned ? 1 : 0}|${isUsed ? 1 : 0}`;
      validNames.add(name);

      const cachedSignature = cache.signatures.get(name);
      let characterCard = cache.nodesByName.get(name);
      const needsUpdate = !characterCard || cachedSignature !== signature;

      // 先复用旧卡片 只有没有缓存时才重新克隆模板
      if (!characterCard) {
        const instance = template.content.cloneNode(true);
        characterCard =
          instance.querySelector(".character-item") ||
          instance.firstElementChild;
      }

      if (characterCard) {
        characterCard.style.display = "";
        characterCard.classList.remove(
          "sortable-ghost",
          "sortable-chosen",
          "sortable-drag"
        );
      }

      if (needsUpdate && characterCard) {
        characterCard.dataset.characterId = characterId;
        characterCard.dataset.characterName = name;
        characterCard.classList.toggle("is-used", !!isUsed);

        const pinButton = characterCard.querySelector(".pin-btn");
        if (pinButton) {
          pinButton.classList.toggle("is-pinned", isPinned);
        }

        renderAvatar(characterCard, characterId, name);
        const nameElement = characterCard.querySelector(".character-name");
        if (nameElement) {
          nameElement.textContent = name;
        }

        cache.signatures.set(name, signature);
        cache.nodesByName.set(name, characterCard);
      }

      if (characterCard) {
        fragment.appendChild(characterCard);
      }
    });

    // 配置里已经删掉的角色 要从缓存里一起清掉
    for (const cachedName of Array.from(cache.nodesByName.keys())) {
      if (!validNames.has(cachedName)) {
        cache.nodesByName.delete(cachedName);
        cache.signatures.delete(cachedName);
      }
    }

    listContainer.replaceChildren(fragment);
  },

  // 绑定置顶按钮
  initPinButtonHandler() {
    const characterList = document.getElementById(this.characterListId);
    if (!characterList) {
      return;
    }

    characterList.addEventListener("click", (clickEvent) => {
      const pinButton = clickEvent.target.closest(".pin-btn");
      if (!pinButton) {
        return;
      }

      clickEvent.stopPropagation();
      clickEvent.preventDefault();

      const characterItem = pinButton.closest(".character-item");
      const characterName = characterItem?.dataset.characterName;
      if (!characterName) {
        return;
      }

      pinnedCharacterManager.toggle(characterName);
      if (typeof this.renderUsedList === "function") {
        this.renderUsedList();
      }
    });
  },
};

// 把角色列表方法加到编辑器上
export function attachCharacterList(editor) {
  Object.assign(editor, characterListMethods);
}
