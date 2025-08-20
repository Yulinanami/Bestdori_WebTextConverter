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
