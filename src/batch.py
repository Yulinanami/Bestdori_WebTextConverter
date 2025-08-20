# 批量处理模块
import base64
import logging
import multiprocessing
import sys
from pathlib import Path
from typing import Dict, Any, Tuple
from .converter import TextConverter
from .config import ConfigManager
from .utils import FileFormatConverter
from concurrent.futures import ProcessPoolExecutor

logger = logging.getLogger(__name__)


def batch_worker(args: Tuple[Dict[str, Any], Dict[str, Any]]) -> Dict[str, Any]:
    file_data, converter_config = args
    converter = TextConverter(ConfigManager())
    if converter_config.get("character_mapping"):
        converter.character_mapping = converter_config["character_mapping"]
    filename = file_data.get("name", "unknown.txt")
    raw_content = file_data.get("content", "")
    encoding = file_data.get("encoding", "text")
    try:
        if encoding == "base64" and filename.lower().endswith(".docx"):
            content_parts = raw_content.split(",")
            if len(content_parts) > 1:
                decoded_bytes = base64.b64decode(content_parts[1])
                text_content = FileFormatConverter.docx_to_text(decoded_bytes)
            else:
                raise ValueError("无效的 Base64 数据")
        elif filename.lower().endswith(".md"):
            text_content = FileFormatConverter.markdown_to_text(raw_content)
        else:
            text_content = raw_content
        json_output = converter.convert_text_to_json_format(
            text_content,
            converter_config.get("narrator_name", " "),
            converter_config.get("selected_quote_pairs", []),
            converter_config.get("enable_live2d", False),
            converter_config.get("custom_costume_mapping"),
            converter_config.get("position_config"),
        )
        return {
            "success": True,
            "name": Path(filename).with_suffix(".json").name,
            "content": json_output,
            "original_name": filename,
        }
    except Exception as e:
        logger.error(f"处理文件 {filename} 时出错: {e}", exc_info=True)
        return {
            "success": False,
            "name": filename,
            "error": str(e),
            "original_name": filename,
        }


class OptimizedBatchProcessor:
    def __init__(self):
        self.max_workers = min(multiprocessing.cpu_count(), 4)
        try:
            if sys.platform.startswith("win"):
                multiprocessing.set_start_method("spawn", force=True)
        except RuntimeError:
            pass
        self.process_pool = ProcessPoolExecutor(max_workers=self.max_workers)
