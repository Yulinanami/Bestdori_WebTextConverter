/**
 * StorageService - 统一的 LocalStorage 操作服务
 * 提供类型安全的存储操作和错误处理
 */

export const STORAGE_KEYS = {
  CHARACTER_MAPPING: "bestdori_character_mapping",
  CUSTOM_QUOTES: "bestdori_custom_quotes",
  PRESET_QUOTES_STATE: "bestdori_preset_quotes_state",
  COSTUME_MAPPING_V2: "bestdori_costume_mapping_v2",
  AVAILABLE_COSTUMES_V2: "bestdori_available_costumes_v2",
  POSITION_CONFIG: "bestdori_position_config",
  CARD_GROUPING: "bestdori_card_grouping_enabled",
  PINNED_CHARACTERS: "bestdori_pinned_characters",
  CUSTOM_MOTIONS: "bestdori_custom_motions",
  CUSTOM_EXPRESSIONS: "bestdori_custom_expressions",
  LIVE2D_SUBSEQUENT_MODE: "bestdori_live2d_subsequent_mode",
  SPEAKER_MULTI_SELECT_MODE: "bestdori_speaker_multi_select_mode",
  SPEAKER_TEXT_EDIT_MODE: "bestdori_speaker_text_edit_mode",
  CUSTOM_QUICK_FILL_OPTIONS: "bestdori_custom_quick_fill_options",
};

class StorageService {
  constructor() {
    // 错误处理回调，可由外部设置
    this.onQuotaExceeded = null;
  }

  /**
   * 获取存储的数据
   * @param {string} key - 存储键
   * @param {any} defaultValue - 默认值
   * @returns {any} 存储的数据或默认值
   */
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      // 尝试解析 JSON，如果失败则返回原始字符串
      try {
        return JSON.parse(item);
      } catch {
        return item;
      }
    } catch (error) {
      console.error(`[StorageService] 读取失败 (${key}):`, error);
      return defaultValue;
    }
  }

  /**
   * 设置存储数据
   * @param {string} key - 存储键
   * @param {any} value - 要存储的值
   * @returns {boolean} 是否成功
   */
  set(key, value) {
    try {
      const serialized =
        typeof value === "string" ? value : JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error(`[StorageService] 保存失败 (${key}):`, error);
      if (error.name === "QuotaExceededError") {
        console.error("LocalStorage 空间已满");
        // 调用回调通知用户
        if (this.onQuotaExceeded) {
          this.onQuotaExceeded(key, this.getSizeFormatted());
        }
      }
      return false;
    }
  }

  /**
   * 删除存储数据
   * @param {string} key - 存储键
   * @returns {boolean} 是否成功
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`[StorageService] 删除失败 (${key}):`, error);
      return false;
    }
  }

  /**
   * 批量删除存储数据
   * @param {string[]} keys - 存储键数组
   * @returns {boolean} 是否全部成功
   */
  removeMultiple(keys) {
    let allSuccess = true;
    keys.forEach((key) => {
      if (!this.remove(key)) {
        allSuccess = false;
      }
    });
    return allSuccess;
  }

  /**
   * 获取存储大小（近似值，单位：字节）
   * @returns {number} 存储大小
   */
  getSize() {
    let size = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        size += localStorage[key].length + key.length;
      }
    }
    return size;
  }

  /**
   * 获取存储大小（可读格式）
   * @returns {string} 如 "1.2 MB"
   */
  getSizeFormatted() {
    const bytes = this.getSize();
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }
}

// 导出单例
export const storageService = new StorageService();
