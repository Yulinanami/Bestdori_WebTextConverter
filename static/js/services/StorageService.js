// localStorage：读/写/删除

export const STORAGE_KEYS = {
  // 这里集中放所有 localStorage 的 key（避免到处写字符串写错）
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
  AUTO_APPEND_SPACES: "bestdori_auto_append_spaces",
  AUTO_APPEND_SPACES_BEFORE_NEWLINE:
    "bestdori_auto_append_spaces_before_newline",
};

class StorageService {
  constructor() {
    // 当存储空间满了时，用这个回调通知 UI（外部可以赋值）
    this.onQuotaExceeded = null;
  }

  // 读取一个 key：如果没有就返回默认值（并自动尝试 JSON.parse）
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

  // 保存一个 key：自动把对象转成 JSON 字符串；失败时返回 false
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

  // 删除一个 key
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`[StorageService] 删除失败 (${key}):`, error);
      return false;
    }
  }

  // 批量删除多个 key（有一个失败就返回 false）
  removeMultiple(keys) {
    let allSuccess = true;
    keys.forEach((key) => {
      if (!this.remove(key)) {
        allSuccess = false;
      }
    });
    return allSuccess;
  }

  // 估算 localStorage 当前占用大小（字节）
  getSize() {
    let size = 0;
    Object.entries(localStorage).forEach(([key, value]) => {
      size += value.length + key.length;
    });
    return size;
  }

  // 把占用大小格式化成人类可读的字符串（例如 1.2 MB）
  getSizeFormatted() {
    const bytes = this.getSize();
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  }
}

// 导出单例（全站共用同一个存储服务）
export const storageService = new StorageService();
