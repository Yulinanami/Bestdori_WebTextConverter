/**
 * StringUtils - 字符串处理工具函数
 */

export const StringUtils = {
  /**
   * 生成唯一 ID
   * @param {string} prefix - 前缀
   * @returns {string}
   */
  generateId(prefix = "id") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * 转换为安全的 DOM ID
   * @param {string} str - 输入字符串
   * @returns {string}
   */
  toSafeDomId(str) {
    return str.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_");
  },

  /**
   * 截断字符串
   * @param {string} str - 输入字符串
   * @param {number} maxLength - 最大长度
   * @param {string} suffix - 后缀
   * @returns {string}
   */
  truncate(str, maxLength = 50, suffix = "...") {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
  },

  /**
   * 首字母大写
   * @param {string} str - 输入字符串
   * @returns {string}
   */
  capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * 转换为驼峰命名
   * @param {string} str - 输入字符串（如 "hello-world"）
   * @returns {string} - 如 "helloWorld"
   */
  toCamelCase(str) {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  },

  /**
   * 转换为短横线命名
   * @param {string} str - 输入字符串（如 "helloWorld"）
   * @returns {string} - 如 "hello-world"
   */
  toKebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
  },

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string}
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  },

  /**
   * 格式化日期时间
   * @param {Date|string|number} date - 日期
   * @param {string} format - 格式（简化版）
   * @returns {string}
   */
  formatDateTime(date, format = "YYYY-MM-DD HH:mm:ss") {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");

    return format
      .replace("YYYY", year)
      .replace("MM", month)
      .replace("DD", day)
      .replace("HH", hours)
      .replace("mm", minutes)
      .replace("ss", seconds);
  },

  /**
   * 转义 HTML 特殊字符
   * @param {string} str - 输入字符串
   * @returns {string}
   */
  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * 解析 HTML 实体
   * @param {string} str - 输入字符串
   * @returns {string}
   */
  unescapeHtml(str) {
    const div = document.createElement("div");
    div.innerHTML = str;
    return div.textContent;
  },

  /**
   * 生成文件名（带时间戳）
   * @param {string} prefix - 前缀
   * @param {string} extension - 扩展名
   * @returns {string}
   */
  generateFilename(prefix = "file", extension = "json") {
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:-]/g, "");
    return `${prefix}_${timestamp}.${extension}`;
  },

  /**
   * 检查是否为空字符串（包括空白字符）
   * @param {string} str - 输入字符串
   * @returns {boolean}
   */
  isEmpty(str) {
    return !str || str.trim().length === 0;
  },

  /**
   * 高亮搜索关键词
   * @param {string} text - 原文本
   * @param {string} keyword - 关键词
   * @param {string} className - 高亮类名
   * @returns {string} HTML 字符串
   */
  highlightKeyword(text, keyword, className = "highlight") {
    if (!keyword) return this.escapeHtml(text);
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escapedKeyword})`, "gi");
    return this.escapeHtml(text).replace(
      regex,
      `<span class="${className}">$1</span>`
    );
  },
};
