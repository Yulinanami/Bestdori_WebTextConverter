import { storageService, STORAGE_KEYS } from "@services/StorageService.js";

const LOCAL_STORAGE_KEY = STORAGE_KEYS.PINNED_CHARACTERS;
let pinnedCharacters = new Set();

// 从本地读取“置顶角色列表”到内存
function load() {
  try {
    const saved = storageService.get(LOCAL_STORAGE_KEY, []);
    pinnedCharacters = new Set(Array.isArray(saved) ? saved : []);
  } catch (error) {
    console.error("加载置顶角色配置失败:", error);
    pinnedCharacters = new Set();
  }
}

// 把当前“置顶角色列表”保存到本地
function save() {
  try {
    storageService.set(LOCAL_STORAGE_KEY, Array.from(pinnedCharacters));
  } catch (error) {
    console.error("保存置顶角色配置失败:", error);
  }
}

// 管理“置顶角色”：让常用角色显示在更靠前的位置
export const pinnedCharacterManager = {
  load,

  // 切换某个角色是否置顶（置顶/取消置顶）
  toggle(characterName) {
    if (pinnedCharacters.has(characterName)) {
      pinnedCharacters.delete(characterName);
    } else {
      pinnedCharacters.add(characterName);
    }
    save();
  },

  // 获取当前所有置顶角色（Set）
  getPinned() {
    return pinnedCharacters;
  },
};
