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
    raw_content_str = file_data.get("content", "")
    encoding = file_data.get("encoding", "text")

    try:
        if encoding == "base64":
            content_parts = raw_content_str.split(",")
            if len(content_parts) > 1:
                file_bytes = base64.b64decode(content_parts[1])
            else:
                file_bytes = base64.b64decode(raw_content_str)
        else:
            file_bytes = raw_content_str.encode("utf-8")
        text_content = FileFormatConverter.read_file_content_to_text(
            filename, file_bytes
        )
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
