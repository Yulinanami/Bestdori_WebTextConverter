const LOCAL_STORAGE_KEY = "bestdori_pinned_characters";
let pinnedCharacters = new Set();

function load() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      pinnedCharacters = new Set(parsed);
    }
  } catch (error) {
    console.error("加载置顶角色配置失败:", error);
    pinnedCharacters = new Set();
  }
}

function save() {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify(Array.from(pinnedCharacters))
    );
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
   * 检查一个角色是否被置顶
   * @param {string} characterName - 角色的名称
   * @returns {boolean}
   */
  isPinned(characterName) {
    return pinnedCharacters.has(characterName);
  },

  /**
   * 获取所有已置顶角色的 Set 集合
   * @returns {Set<string>}
   */
  getPinned() {
    return pinnedCharacters;
  },
};
