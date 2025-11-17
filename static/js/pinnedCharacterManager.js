import { storageService, STORAGE_KEYS } from "./services/StorageService.js";

const LOCAL_STORAGE_KEY = STORAGE_KEYS.PINNED_CHARACTERS;
let pinnedCharacters = new Set();

function load() {
  try {
    const saved = storageService.get(LOCAL_STORAGE_KEY, []);
    pinnedCharacters = new Set(Array.isArray(saved) ? saved : []);
  } catch (error) {
    console.error("加载置顶角色配置失败:", error);
    pinnedCharacters = new Set();
  }
}

function save() {
  try {
    storageService.set(LOCAL_STORAGE_KEY, Array.from(pinnedCharacters));
  } catch (error) {
    console.error("保存置顶角色配置失败:", error);
  }
}

export const pinnedCharacterManager = {
  load,

  /**
   * 切换一个角色的置顶状态
   * @param {string} characterName - 角色的名称
   */
  toggle(characterName) {
    if (pinnedCharacters.has(characterName)) {
      pinnedCharacters.delete(characterName);
    } else {
      pinnedCharacters.add(characterName);
    }
    save();
  },

  /**
   * 获取所有已置顶角色的 Set 集合
   * @returns {Set<string>}
   */
  getPinned() {
    return pinnedCharacters;
  },
};
