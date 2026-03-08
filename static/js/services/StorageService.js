// localStorage 的读写和删除

export const STORAGE_KEYS = {
  // 统一放 localStorage 的 key
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
    // 存储空间满了时用这个回调通知页面
    this.onQuotaExceeded = null;
  }

  // 读取存储项
  load(key, defaultValue = null) {
    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue === null) {
        return defaultValue;
      }
      // JSON 解析失败时返回原始字符串
      try {
        return JSON.parse(storedValue);
      } catch {
        return storedValue;
      }
    } catch (error) {
      console.error(`[StorageService] 读取失败 (${key}):`, error);
      return defaultValue;
    }
  }

  // 保存一个存储项
  save(key, value) {
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
          this.onQuotaExceeded(key, this.formatSizeText());
        }
      }
      return false;
    }
  }

  // 删除一个存储项
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`[StorageService] 删除失败 (${key}):`, error);
      return false;
    }
  }

  // 批量删除多个存储项
  removeMultiple(keys) {
    let allSuccess = true;
    // 逐个删除
    keys.forEach((key) => {
      if (!this.remove(key)) {
        allSuccess = false;
      }
    });
    return allSuccess;
  }

  // 估算 localStorage 当前占用大小
  measureSize() {
    let size = 0;
    // 累加每条内容的长度
    Object.entries(localStorage).forEach(([key, value]) => {
      size += value.length + key.length;
    });
    return size;
  }

  // 把占用大小转成易读的文字
  formatSizeText() {
    const bytes = this.measureSize();
    if (bytes === 0) return "0 Bytes";
    const bytesPerUnit = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const unitIndex = Math.floor(Math.log(bytes) / Math.log(bytesPerUnit));
    return `${Math.round((bytes / Math.pow(bytesPerUnit, unitIndex)) * 100) / 100} ${sizes[unitIndex]}`;
  }
}

// 导出单例
export const storageService = new StorageService();
