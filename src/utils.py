# 文本格式转换器
import io
import re
import logging
import markdown2
from docx import Document

logger = logging.getLogger(__name__)


class FileFormatConverter:
    @staticmethod
    def docx_to_text(file_content: bytes) -> str:
        try:
            doc = Document(io.BytesIO(file_content))
            text_lines = []
            for paragraph in doc.paragraphs:
                if paragraph.text.strip():
                    text_lines.append(paragraph.text.strip())
            return "\n\n".join(text_lines)
        except Exception as e:
            logger.error(f"Word文档解析失败: {e}")
            raise ValueError(f"无法解析Word文档: {str(e)}")

    @staticmethod
    def markdown_to_text(md_content: str) -> str:
        try:
            html = markdown2.markdown(md_content)
            text = re.sub(r"<[^>]+>", "", html)
            text = text.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            return "\n\n".join(lines)
        except Exception as e:
            logger.error(f"Markdown解析失败: {e}")
            raise ValueError(f"无法解析Markdown: {str(e)}")

    @staticmethod
    def read_file_content_to_text(filename: str, content: bytes) -> str:
        filename_lower = filename.lower()
        try:
            if filename_lower.endswith(".docx"):
                return FileFormatConverter.docx_to_text(content)
            elif filename_lower.endswith(".md"):
                return FileFormatConverter.markdown_to_text(content.decode("utf-8"))
            else:
                return content.decode("utf-8")
        except UnicodeDecodeError:
            logger.warning(
                f"UTF-8 decoding failed for {filename}, trying with latin-1."
            )
            return content.decode("latin-1", errors="replace")
        except Exception as e:
            logger.error(f"Failed to process file {filename}: {e}")
            raise
