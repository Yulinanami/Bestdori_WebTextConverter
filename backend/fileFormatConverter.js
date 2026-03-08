// 把上传文件转成纯文本
const mammoth = require("mammoth");
const { marked } = require("marked");
const { createLogger } = require("./logger");

const logger = createLogger("src.utils");

class FileFormatConverter {
  // 读取 Word
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

  // 读取 Markdown
  static markdownToText(mdContent) {
    // 先转 HTML 再去标签
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

  // 先按 utf8 读取 失败时再用 latin1
  static decodeUtf8OrLatin1(content) {
    try {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      return decoder.decode(content);
    } catch {
      logger.warning("UTF-8 解码失败，尝试使用 latin-1。");
      const fallbackDecoder = new TextDecoder("latin1", { fatal: false });
      return fallbackDecoder.decode(content);
    }
  }

  // 按后缀选读取方式
  static async readFileContentToText(filename, content) {
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
