// 置顶角色
import { storageService, STORAGE_KEYS } from "@services/StorageService.js";

const LOCAL_STORAGE_KEY = STORAGE_KEYS.PINNED_CHARACTERS;
export const pinnedCharacters = new Set();

// 从本地读取置顶角色
function load() {
  try {
    const saved = storageService.load(LOCAL_STORAGE_KEY, []);
    pinnedCharacters.clear();
    (Array.isArray(saved) ? saved : []).forEach((name) =>
      pinnedCharacters.add(name),
    );
  } catch (error) {
    console.error("加载置顶角色配置失败:", error);
    pinnedCharacters.clear();
  }
}

// 把置顶角色存回本地
function save() {
  try {
    storageService.save(LOCAL_STORAGE_KEY, Array.from(pinnedCharacters));
  } catch (error) {
    console.error("保存置顶角色配置失败:", error);
  }
}

// 对外提供置顶角色功能
export const pinnedCharacterManager = {
  load,

  // 切换角色是否置顶
  toggle(characterName) {
    if (pinnedCharacters.has(characterName)) {
      pinnedCharacters.delete(characterName);
    } else {
      pinnedCharacters.add(characterName);
    }
    save();
  },

};
