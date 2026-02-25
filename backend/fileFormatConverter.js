// 文件内容转换：把上传文件统一解析成纯文本
const mammoth = require("mammoth");
const { marked } = require("marked");
const { createLogger } = require("./logger");

const logger = createLogger("src.utils");

class FileFormatConverter {
  // docx（二进制） -> 纯文本
  static async docxToText(fileContent) {
    try {
      const result = await mammoth.extractRawText({ buffer: fileContent });
      const lines = result.value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      return lines.join("\n\n");
    } catch (error) {
      logger.error(`Word文档解析失败: ${error.message}`);
      throw new Error(`无法解析Word文档: ${error.message}`);
    }
  }

  static markdownToText(mdContent) {
    // Markdown -> HTML -> 去标签文本
    try {
      const html = marked.parse(mdContent);
      let text = html.replace(/<[^>]+>/g, "");
      text = text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      return lines.join("\n\n");
    } catch (error) {
      logger.error(`Markdown解析失败: ${error.message}`);
      throw new Error(`无法解析Markdown: ${error.message}`);
    }
  }

  static decodeUtf8OrLatin1(content) {
    // 先尝试 UTF-8，失败再回退 latin-1
    try {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      return decoder.decode(content);
    } catch {
      logger.warning("UTF-8 解码失败，尝试使用 latin-1。");
      const fallbackDecoder = new TextDecoder("latin1", { fatal: false });
      return fallbackDecoder.decode(content);
    }
  }

  static async readFileContentToText(filename, content) {
    // 按文件后缀选择对应解析策略
    const lower = filename.toLowerCase();
    if (lower.endsWith(".docx")) {
      return this.docxToText(content);
    }
    if (lower.endsWith(".md")) {
      const text = this.decodeUtf8OrLatin1(content);
      return this.markdownToText(text);
    }
    return this.decodeUtf8OrLatin1(content);
  }
}

module.exports = { FileFormatConverter };
