/**
 * StringUtils - 字符串处理工具函数
 */

export const StringUtils = {
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
};
