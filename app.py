import json
import re
import logging
import io
import base64
import yaml
import tempfile
import os
import multiprocessing
import uuid
import sys
import threading
import webbrowser
import markdown2
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from docx import Document
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod
from werkzeug.utils import secure_filename
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from flask import Flask, render_template, request, jsonify, send_file

project_root = os.path.dirname(os.path.abspath(__file__))
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)
template_folder = os.path.join(project_root, "templates")
static_folder = os.path.join(project_root, "static")
app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
# app.config["UPLOAD_FOLDER"] = "/tmp"


class OptimizedBatchProcessor:
    def __init__(self):
        self.max_workers = min(multiprocessing.cpu_count(), 4)
        self.process_pool = ProcessPoolExecutor(max_workers=self.max_workers)

    def process_single_file_wrapper(self, args):
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
            }
        except Exception as e:
            return {"success": False, "name": filename, "error": str(e)}


batch_processor = OptimizedBatchProcessor()


@dataclass
class ActionItem:
    type: str = "talk"
    delay: int = 0
    wait: bool = True
    characters: List[int] = None
    name: str = ""
    body: str = ""
    motions: List[str] = None
    voices: List[str] = None
    close: bool = False

    def __post_init__(self):
        if self.characters is None:
            self.characters = []
        if self.motions is None:
            self.motions = []
        if self.voices is None:
            self.voices = []


@dataclass
class LayoutActionItem:
    type: str = "layout"
    delay: int = 0
    wait: bool = True
    layoutType: str = "appear"
    character: int = 0
    costume: str = ""
    motion: str = ""
    expression: str = ""
    sideFrom: str = "center"
    sideFromOffsetX: int = 0
    sideTo: str = "center"
    sideToOffsetX: int = 0


@dataclass
class ConversionResult:
    server: int = 0
    voice: str = ""
    background: Optional[str] = None
    bgm: Optional[str] = None
    actions: List[Dict[str, Any]] = None

    def __post_init__(self):
        if self.actions is None:
            self.actions = []


class ConfigManager:
    def __init__(self, config_path: str = "config.yaml"):
        if not os.path.isabs(config_path):
            config_path = os.path.join(project_root, config_path)
        self.config_path = Path(config_path)
        self.config = self._load_config()
        logger.info(f"ConfigManager using config file: {self.config_path}")

    def _load_config(self) -> Dict[str, Any]:
        default_config = {
            "character_mapping": {
                # Poppin'Party
                "户山香澄": [1],
                "花园多惠": [2],
                "牛込里美": [3],
                "山吹沙绫": [4],
                "市谷有咲": [5],
                # Afterglow
                "美竹兰": [6],
                "青叶摩卡": [7],
                "上原绯玛丽": [8],
                "宇田川巴": [9],
                "羽泽鸫": [10],
                # Hello, Happy World!
                "弦卷心": [11],
                "濑田薰": [12],
                "北泽育美": [13],
                "松原花音": [14],
                "奥泽美咲": [15],
                # Pastel*Palettes
                "丸山彩": [16],
                "冰川日菜": [17],
                "白鹭千圣": [18],
                "大和麻弥": [19],
                "若宫伊芙": [20],
                # Roselia
                "凑友希那": [21],
                "冰川纱夜": [22],
                "今井莉莎": [23],
                "宇田川亚子": [24],
                "白金燐子": [25],
                # Morfonica
                "仓田真白": [26],
                "桐谷透子": [27],
                "广町七深": [28],
                "二叶筑紫": [29],
                "八潮瑠唯": [30],
                # RAISE A SUILEN
                "LAYER": [31],
                "LOCK": [32],
                "MASKING": [33],
                "PAREO": [34],
                "CHU²": [35],
                # MyGo
                "高松灯": [36],
                "千早爱音": [37],
                "要乐奈": [38],
                "长崎素世": [39],
                "椎名立希": [40],
                # Sumimi
                "纯田真奈": [229],
                # Mujica
                "三角初华": [337],
                "若叶睦": [338],
                "八幡海铃": [339],
                "祐天寺若麦": [340],
                "丰川祥子": [341],
            },
            "costume_mapping": {  # 每个角色的服装映射
                # Poppin'Party
                1: [
                    "001_school_summer-2023",
                    "001_school_winter-2023",
                    "001_casual-2023",
                    "001_live_r_2023",
                ],
                2: [
                    "002_school_summer-2023",
                    "002_school_winter-2023",
                    "002_casual-2023",
                    "002_live_r_2023",
                ],
                3: [
                    "003_school_summer-2023",
                    "003_school_winter-2023",
                    "003_casual-2023",
                    "003_live_r_2023",
                ],
                4: [
                    "004_school_summer-2023",
                    "004_school_winter-2023",
                    "004_casual-2023",
                    "004_live_r_2023",
                ],
                5: [
                    "005_school_summer-2023",
                    "005_school_winter-2023",
                    "005_casual-2023",
                    "005_live_r_2023",
                ],
                # Afterglow
                6: [
                    "006_school_summer-2023",
                    "006_school_winter-2023",
                    "006_casual-2023",
                    "006_live_r_2023",
                ],
                7: [
                    "007_school_summer-2023",
                    "007_school_winter-2023",
                    "007_casual-2023",
                    "007_live_r_2023",
                ],
                8: [
                    "008_school_summer-2023",
                    "008_school_winter-2023",
                    "008_casual-2023",
                    "008_live_r_2023",
                ],
                9: [
                    "009_school_summer-2023",
                    "009_school_winter-2023",
                    "009_casual-2023",
                    "009_live_r_2023",
                ],
                10: [
                    "010_school_summer-2023",
                    "010_school_winter-2023",
                    "010_casual-2023",
                    "010_live_r_2023",
                ],
                # Hello, Happy World!
                11: [
                    "011_school_summer-2023",
                    "011_school_winter-2023",
                    "011_casual-2023",
                    "011_live_r_2023",
                ],
                12: [
                    "012_school_summer_s2",
                    "012_school_winter_s2",
                    "012_casual-2023",
                    "012_live_r_2023",
                ],
                13: [
                    "013_school_summer-2023",
                    "013_school_winter-2023",
                    "013_casual-2023",
                    "013_live_r_2023",
                ],
                14: [
                    "014_school_summer",
                    "014_school_winter_v3",
                    "014_casual-2023",
                    "014_live_r_2023",
                ],
                15: [
                    "015_school_summer-2023",
                    "015_school_winter-2023",
                    "015_casual-2023",
                    "015_live_r_2023",
                ],
                # Pastel*Palettes
                16: [
                    "016_school_summer",
                    "016_school_winter",
                    "016_casual-2023",
                    "016_live_r_2023",
                ],
                17: [
                    "017_school_summer_s2",
                    "017_school_winter_s2",
                    "017_casual-2023",
                    "017_live_r_2023",
                ],
                18: [
                    "018_school_summer",
                    "018_school_winter",
                    "018_casual-2023",
                    "018_live_r_2023",
                ],
                19: [
                    "019_school_summer_s2",
                    "019_school_winter_s2",
                    "019_casual-2023",
                    "019_live_r_2023",
                ],
                20: [
                    "020_school_summer-2023",
                    "020_school_winter-2023",
                    "020_casual-2023",
                    "020_live_r_2023",
                ],
                # Roselia
                21: [
                    "021_school_summer_s2",
                    "021_school_winter_s2",
                    "021_casual-2023",
                    "021_live_r_2023",
                ],
                22: [
                    "022_school_summer",
                    "022_school_winter_v3",
                    "022_casual-2023",
                    "022_live_r_2023",
                ],
                23: [
                    "023_school_summer_s2",
                    "023_school_winter_s2",
                    "023_casual-2023",
                    "023_live_r_2023",
                ],
                24: [
                    "024_school_summer-2023",
                    "024_school_winter-2023",
                    "024_casual-2023",
                    "024_live_r_2023",
                ],
                25: [
                    "025_school_summer",
                    "025_school_winter_v3",
                    "025_casual-2023",
                    "025_live_r_2023",
                ],
                # Morfonica
                26: [
                    "026_school_summer-2023",
                    "026_school_winter-2023",
                    "026_casual-2023",
                    "026_live_r_2023",
                ],
                27: [
                    "027_school_summer-2023",
                    "027_school_winter-2023",
                    "027_casual-2023",
                    "027_live_r_2023",
                ],
                28: [
                    "028_school_summer-2023",
                    "028_school_winter-2023",
                    "028_casual-2023",
                    "028_live_r_2023",
                ],
                29: [
                    "029_school_summer-2023",
                    "029_school_winter-2023",
                    "029_casual-2023",
                    "029_live_r_2023",
                ],
                30: [
                    "030_school_summer-2023",
                    "030_school_winter-2023",
                    "030_casual-2023",
                    "030_live_r_2023",
                ],
                # RAISE A SUILEN
                31: ["031_live_r_2023", "031_casual-2023"],
                32: [
                    "032_school_summer-2023",
                    "032_school_winter-2023",
                    "032_live_r_2023",
                    "032_casual-2023",
                ],
                33: ["033_school_winter", "033_live_r_2023", "033_casual-2023"],
                34: ["034_school_winter-2023", "034_live_r_2023", "034_casual-2023"],
                35: ["035_school_winter-2023", "035_live_r_2023", "035_casual-2023"],
                # MyGO
                36: [
                    "036_school_summer-2023",
                    "036_school_winter-2023",
                    "036_live_default",
                    "036_casual-2023",
                ],
                37: [
                    "037_school_summer-2023",
                    "037_school_winter-2023",
                    "037_live_default",
                    "037_casual-2023",
                ],
                38: [
                    "038_school_summer-2023",
                    "038_school_winter-2023",
                    "038_live_default",
                    "038_casual-2023",
                    "343_event_286_story_01",
                ],
                39: [
                    "039_school_summer-2023",
                    "039_school_winter-2023",
                    "039_live_default",
                    "039_casual-2023",
                ],
                40: [
                    "040_school_summer-2023",
                    "040_school_winter-2023",
                    "040_live_default",
                    "040_casual-2023",
                ],
                # Sumimi
                229: ["229_sumimi"],
                # Mujica
                337: [
                    "337_sumimi",
                    "337_school_summer-2023",
                    "337_school_winter-2023",
                    "337_casual-2023",
                    "337_casual-2023_nocap",
                    "337_event_297_story_01",
                ],
                338: [
                    "338_school_summer-2023",
                    "338_school_winter-2023",
                    "338_casual-2023",
                    "338_event_297_story_01",
                ],
                339: [
                    "339_school_summer-2023",
                    "339_school_winter-2023",
                    "339_casual-2023",
                    "339_event_297_story_01",
                ],
                340: [
                    "340_casual-2023",
                    "340_event_297_story_01",
                ],
                341: [
                    "341_jh_school_winter-2023",
                    "341_school_summer-2023",
                    "341_school_winter-2023",
                    "341_casual-2023",
                    "341_event_297_story_01",
                ],
            },
            "default_costumes": {  # 每个角色的默认服装
                1: "001_casual-2023",
                2: "002_casual-2023",
                3: "003_casual-2023",
                4: "004_casual-2023",
                5: "005_casual-2023",
                6: "006_casual-2023",
                7: "007_casual-2023",
                8: "008_casual-2023",
                9: "009_casual-2023",
                10: "010_casual-2023",
                11: "011_casual-2023",
                12: "012_casual-2023",
                13: "013_casual-2023",
                14: "014_casual-2023",
                15: "015_casual-2023",
                16: "016_casual-2023",
                17: "017_casual-2023",
                18: "018_casual-2023",
                19: "019_casual-2023",
                20: "020_casual-2023",
                21: "021_casual-2023",
                22: "022_casual-2023",
                23: "023_casual-2023",
                24: "024_casual-2023",
                25: "025_casual-2023",
                26: "026_casual-2023",
                27: "027_casual-2023",
                28: "028_casual-2023",
                29: "029_casual-2023",
                30: "030_casual-2023",
                31: "031_casual-2023",
                32: "032_casual-2023",
                33: "033_casual-2023",
                34: "034_casual-2023",
                35: "035_casual-2023",
                36: "036_casual-2023",
                37: "037_casual-2023",
                38: "038_casual-2023",
                39: "039_casual-2023",
                40: "040_casual-2023",
                229: "229_sumimi",
                337: "337_casual-2023",
                338: "338_casual-2023",
                339: "339_casual-2023",
                340: "340_casual-2023",
                341: "341_casual-2023",
            },
            "parsing": {"max_speaker_name_length": 50, "default_narrator_name": " "},
            "patterns": {"speaker_pattern": r"^([\w\s]+)\s*[：:]\s*(.*)$"},
            "quotes": {
                "quote_pairs": {
                    '"': '"',
                    "“": "”",
                    "'": "'",
                    "‘": "’",
                    "「": "」",
                    "『": "』",
                },
                "quote_categories": {
                    "中文引号 “...”": ["“", "”"],
                    "中文单引号 ‘...’": ["‘", "’"],
                    "日文引号 「...」": ["「", "」"],
                    "日文书名号 『...』": ["『", "』"],
                    '英文双引号 "..."': ['"', '"'],
                    "英文单引号 '...'": ["'", "'"],
                },
            },
        }
        if not self.config_path.exists():
            self._save_config(default_config)
            return default_config
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                loaded_config = yaml.safe_load(f) or default_config
                quotes_section = loaded_config.get("quotes", {})
                if (
                    "quote_categories" not in quotes_section
                    or len(quotes_section["quote_categories"]) < 6
                ):
                    logger.warning(
                        "旧的或不完整的引号配置，将使用最新的默认配置进行更新。"
                    )
                    loaded_config["quotes"] = default_config["quotes"]
                    self._save_config(loaded_config)
                if "costume_mapping" not in loaded_config:
                    loaded_config["costume_mapping"] = default_config["costume_mapping"]
                if "default_costumes" not in loaded_config:
                    loaded_config["default_costumes"] = default_config[
                        "default_costumes"
                    ]
                return loaded_config
        except Exception as e:
            logger.warning(f"配置文件加载失败: {e}")
            return default_config

    def _save_config(self, config: Dict[str, Any]):
        try:
            with open(self.config_path, "w", encoding="utf-8") as f:
                yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
        except Exception as e:
            logger.error(f"配置文件保存失败: {e}")

    def get_character_mapping(self) -> Dict[str, List[int]]:
        return self.config.get("character_mapping", {})

    def get_parsing_config(self) -> Dict[str, Any]:
        return self.config.get("parsing", {})

    def get_patterns(self) -> Dict[str, str]:
        return self.config.get("patterns", {})

    def get_quotes_config(self) -> Dict[str, Any]:
        return self.config.get("quotes", {})

    def get_costume_mapping(self) -> Dict[int, str]:
        return self.config.get("default_costumes", {})

    def get_available_costumes(self) -> Dict[int, List[str]]:
        return self.config.get("costume_mapping", {})

    def update_character_mapping(self, new_mapping: Dict[str, List[int]]):
        self.config["character_mapping"] = new_mapping
        self._save_config(self.config)


class DialogueParser(ABC):
    @abstractmethod
    def parse(self, line: str) -> Optional[Tuple[str, str]]:
        pass


class SpeakerParser(DialogueParser):
    def __init__(self, pattern: str, max_name_length: int):
        self.pattern = re.compile(pattern, re.UNICODE)
        self.max_name_length = max_name_length

    def parse(self, line: str) -> Optional[Tuple[str, str]]:
        match = self.pattern.match(line.strip())
        if match:
            try:
                speaker_name = match.group(1).strip()
                if len(speaker_name) < self.max_name_length:
                    return speaker_name, match.group(2).strip()
            except IndexError:
                return None
        return None


class QuoteHandler:
    def remove_quotes(self, text: str, active_quote_pairs: Dict[str, str]) -> str:
        stripped = text.strip()
        if len(stripped) < 2:
            return text
        first_char = stripped[0]
        expected_closing = active_quote_pairs.get(first_char)
        if expected_closing and stripped[-1] == expected_closing:
            return stripped[1:-1].strip()
        return text


class TextConverter:
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.character_mapping = config_manager.get_character_mapping()
        self.costume_mapping = config_manager.get_costume_mapping()
        self.parsing_config = config_manager.get_parsing_config()
        self.patterns = config_manager.get_patterns()
        self._init_parsers()
        self.mujica_output_mapping = {
            229: 6,  # 纯田真奈
            337: 1,  # 三角初华
            338: 2,  # 若叶睦
            339: 3,  # 八幡海铃
            340: 4,  # 祐天寺若麦
            341: 5,  # 丰川祥子
        }

    def _init_parsers(self):
        self.parser = SpeakerParser(
            self.patterns.get("speaker_pattern", r"^([\w\s]+)\s*[：:]\s*(.*)$"),
            self.parsing_config.get("max_speaker_name_length", 50),
        )
        self.quote_handler = QuoteHandler()

    def _get_output_character_ids(self, character_ids: List[int]) -> List[int]:
        output_ids = []
        for char_id in character_ids:
            if char_id in self.mujica_output_mapping:
                output_ids.append(self.mujica_output_mapping[char_id])
            else:
                output_ids.append(char_id)
        return output_ids

    def _get_effective_character_id(
        self,
        character_name: str,
        character_ids: List[int],
    ) -> int:
        """获取角色的有效ID"""
        return character_ids[0] if character_ids else 0

    def convert_text_to_json_format(
        self,
        input_text: str,
        narrator_name: str,
        selected_quote_pairs_list: List[List[str]],
        enable_live2d: bool = False,
        custom_costume_mapping: Dict[str, str] = None,
        position_config: Dict[str, Any] = None,
    ) -> str:
        active_quote_pairs = {
            pair[0]: pair[1]
            for pair in selected_quote_pairs_list
            if isinstance(pair, list) and len(pair) == 2
        }
        actions = []
        appeared_character_names = set()
        appearance_order = {}
        current_action_name = narrator_name
        current_action_body_lines = []
        effective_costume_mapping = {}
        if enable_live2d:
            effective_costume_mapping = self.costume_mapping.copy()
            if custom_costume_mapping:
                logger.info(f"自定义服装映射: {custom_costume_mapping}")
                effective_costume_mapping.update(custom_costume_mapping)
                logger.info(
                    f"合并后的服装映射（部分）: {dict(list(effective_costume_mapping.items())[:5])}"
                )
        auto_position_mode = True
        manual_positions = {}
        positions = ["leftInside", "center", "rightInside"]
        if position_config:
            auto_position_mode = position_config.get("autoPositionMode", True)
            manual_positions = position_config.get("manualPositions", {})
            logger.info(
                f"位置配置 - 自动模式: {auto_position_mode}, 手动配置: {manual_positions}"
            )

        # 获取角色位置的辅助函数
        def get_character_position_config(
            character_name: str,
            order: int,
        ) -> Dict[str, Any]:
            """根据配置获取角色的位置和偏移"""
            if auto_position_mode:
                return {"position": positions[order % len(positions)], "offset": 0}
            else:
                config = manual_positions.get(character_name, {})
                if isinstance(config, str):
                    return {"position": config, "offset": 0}
                else:
                    return {
                        "position": config.get("position", "center"),
                        "offset": config.get("offset", 0),
                    }

        def finalize_current_action():
            if current_action_body_lines:
                body = "\n".join(current_action_body_lines).strip()
                finalized_body = self.quote_handler.remove_quotes(
                    body, active_quote_pairs
                )
                if finalized_body:
                    character_ids = self.character_mapping.get(current_action_name, [])

                    if (
                        enable_live2d
                        and character_ids
                        and current_action_name != narrator_name
                    ):
                        primary_character_id = character_ids[0]
                        effective_id = self._get_effective_character_id(
                            current_action_name, character_ids
                        )
                        if current_action_name not in appeared_character_names:
                            appeared_character_names.add(current_action_name)
                            order = len(appearance_order)
                            appearance_order[current_action_name] = order
                            position_config = get_character_position_config(
                                current_action_name, order
                            )
                            position = position_config["position"]
                            offset = position_config["offset"]
                            costume_id = ""
                            if custom_costume_mapping:
                                costume_id = custom_costume_mapping.get(
                                    current_action_name, ""
                                )
                                logger.info(
                                    f"从自定义映射获取 {current_action_name} 的服装: {costume_id}"
                                )
                            if not costume_id and effective_costume_mapping:
                                costume_id = effective_costume_mapping.get(
                                    effective_id, ""
                                )
                                logger.info(
                                    f"从默认映射获取 ID {effective_id} 的服装: {costume_id}"
                                )
                            logger.info(
                                f"角色 {current_action_name} (ID: {primary_character_id}) 最终使用服装: {costume_id}"
                            )
                            logger.info(
                                f"角色 {current_action_name} 分配到位置: {position}，偏移: {offset}"
                            )
                            output_char_id = self.mujica_output_mapping.get(
                                primary_character_id, primary_character_id
                            )
                            layout_action = LayoutActionItem(
                                character=output_char_id,
                                costume=costume_id,
                                sideFrom=position,
                                sideTo=position,
                                sideFromOffsetX=offset,
                                sideToOffsetX=offset,
                            )
                            actions.append(layout_action)
                    output_character_ids = self._get_output_character_ids(character_ids)
                    talk_action = ActionItem(
                        characters=output_character_ids,
                        name=current_action_name,
                        body=finalized_body,
                    )
                    actions.append(talk_action)

        for line in input_text.split("\n"):
            stripped_line = line.strip()
            if not stripped_line:
                finalize_current_action()
                current_action_name = narrator_name
                current_action_body_lines = []
                continue
            parse_result = self.parser.parse(stripped_line)
            if parse_result:
                speaker, content = parse_result
                if speaker != current_action_name and current_action_body_lines:
                    finalize_current_action()
                    current_action_body_lines = []
                current_action_name = speaker
                current_action_body_lines.append(content)
            else:
                current_action_body_lines.append(stripped_line)
        finalize_current_action()
        all_actions = [asdict(action) for action in actions]
        result = ConversionResult(actions=all_actions)
        return json.dumps(asdict(result), ensure_ascii=False, indent=2)


# 文件格式转换器
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
        """将Markdown转换为纯文本，保留对话格式"""
        try:
            html = markdown2.markdown(md_content)
            text = re.sub(r"<[^>]+>", "", html)
            text = text.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            return "\n\n".join(lines)
        except Exception as e:
            logger.error(f"Markdown解析失败: {e}")
            raise ValueError(f"无法解析Markdown: {str(e)}")


config_manager = ConfigManager()
file_converter = FileFormatConverter()
batch_tasks = {}
executor = ThreadPoolExecutor(max_workers=2)


def run_batch_task(
    task_id: str,
    files_data: List[Dict[str, str]],
    narrator_name: str,
    selected_quote_pairs: List[List[str]],
    custom_character_mapping: Dict[str, List[int]] = None,
    enable_live2d: bool = False,
    custom_costume_mapping: Dict[int, str] = None,
):
    if custom_costume_mapping:
        fixed_costume_mapping = {}
        for str_key, value in custom_costume_mapping.items():
            try:
                int_key = int(str_key)
                fixed_costume_mapping[int_key] = value
            except (ValueError, AttributeError):
                fixed_costume_mapping[str_key] = value
        custom_costume_mapping = fixed_costume_mapping
    total_files = len(files_data)
    task = batch_tasks[task_id]
    batch_converter = TextConverter(config_manager)
    if custom_character_mapping:
        batch_converter.character_mapping = custom_character_mapping
    for i, file_data in enumerate(files_data):
        filename = file_data.get("name", "unknown.txt")
        raw_content = file_data.get("content", "")
        encoding = file_data.get("encoding", "text")
        task["progress"] = (i / total_files) * 100
        task["status_text"] = f"正在处理 ({i+1}/{total_files}): {filename}"
        task["logs"].append(f"[INFO] 开始处理: {filename}")
        try:
            text_content = ""
            if encoding == "base64" and filename.lower().endswith(".docx"):
                content_parts = raw_content.split(",")
                if len(content_parts) > 1:
                    base64_content = content_parts[1]
                    decoded_bytes = base64.b64decode(base64_content)
                    text_content = file_converter.docx_to_text(decoded_bytes)
                else:
                    raise ValueError("无效的 Base64 数据")
            elif filename.lower().endswith(".md"):
                text_content = file_converter.markdown_to_text(raw_content)
            else:
                text_content = raw_content
            json_output = batch_converter.convert_text_to_json_format(
                text_content,
                narrator_name,
                selected_quote_pairs,
                enable_live2d,
                custom_costume_mapping,
            )
            task["results"].append(
                {
                    "name": Path(filename).with_suffix(".json").name,
                    "content": json_output,
                }
            )
            task["logs"].append(f"[SUCCESS] 处理成功: {filename}")
        except Exception as e:
            error_msg = f"处理失败: {filename} - {e}"
            task["logs"].append(f"[ERROR] {error_msg}")
            task["errors"].append(error_msg)
    task["progress"] = 100
    task["status_text"] = (
        f"处理完成！成功: {len(task['results'])}, 失败: {len(task['errors'])}."
    )
    task["status"] = "completed"
    task["logs"].append(f"[INFO] {task['status_text']}")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/convert", methods=["POST"])
def convert_text():
    try:
        data = request.get_json()
        input_text = data.get("text", "")
        narrator_name = data.get("narrator_name", " ")
        selected_pairs = data.get("selected_quote_pairs", [])
        custom_character_mapping = data.get("character_mapping", None)
        enable_live2d = data.get("enable_live2d", False)
        custom_costume_mapping = data.get("costume_mapping", None)
        position_config = data.get("position_config", None)
        if custom_costume_mapping:
            fixed_costume_mapping = {}
            for str_key, value in custom_costume_mapping.items():
                try:
                    int_key = int(str_key)
                    fixed_costume_mapping[int_key] = value
                except ValueError:
                    fixed_costume_mapping[str_key] = value
            custom_costume_mapping = fixed_costume_mapping
            logger.info(f"修复后的服装映射: {custom_costume_mapping}")
        if not input_text.strip():
            return jsonify({"error": "输入文本不能为空"}), 400
        request_converter = TextConverter(config_manager)
        if custom_character_mapping:
            request_converter.character_mapping = custom_character_mapping
        result = request_converter.convert_text_to_json_format(
            input_text,
            narrator_name,
            selected_pairs,
            enable_live2d,
            custom_costume_mapping,
            position_config,
        )
        return jsonify({"result": result})
    except Exception as e:
        logger.error(f"转换失败: {e}", exc_info=True)
        return jsonify({"error": f"转换失败: {str(e)}"}), 500


@app.route("/api/batch_convert/status/<task_id>", methods=["GET"])
def get_batch_status(task_id):
    task = batch_tasks.get(task_id)
    if not task:
        return jsonify({"error": "未找到该任务"}), 404
    response_data = {
        "status": task["status"],
        "progress": task["progress"],
        "status_text": task["status_text"],
        "logs": task["logs"],
    }
    if task["status"] == "completed":
        response_data["results"] = task["results"]
        response_data["errors"] = task["errors"]
        # 在一段时间后从内存中移除已完成的任务，以防内存泄漏
        threading.Timer(300, lambda: batch_tasks.pop(task_id, None)).start()
    return jsonify(response_data)


# 批量处理相关接口
@app.route("/api/batch_convert/start", methods=["POST"])
def start_batch_conversion():
    try:
        data = request.get_json()
        files_data = data.get("files", [])
        if not files_data:
            return jsonify({"error": "没有提供任何文件"}), 400
        converter_config = {
            "narrator_name": data.get("narrator_name", " "),
            "selected_quote_pairs": data.get("selected_quote_pairs", []),
            "character_mapping": data.get("character_mapping"),
            "enable_live2d": data.get("enable_live2d", False),
            "custom_costume_mapping": data.get("costume_mapping"),
            "position_config": data.get("position_config"),
        }
        task_id = str(uuid.uuid4())

        def run_batch_async():
            batch_tasks[task_id] = {
                "status": "running",
                "progress": 0,
                "status_text": "正在准备...",
                "logs": [],
                "results": [],
                "errors": [],
            }
            total_files = len(files_data)
            args_list = [(file_data, converter_config) for file_data in files_data]
            with ThreadPoolExecutor(max_workers=4) as executor:
                futures = []
                for i, args in enumerate(args_list):
                    future = executor.submit(
                        batch_processor.process_single_file_wrapper, args
                    )
                    futures.append((i, future))
                for i, future in futures:
                    try:
                        result = future.result(timeout=30)
                        progress = ((i + 1) / total_files) * 100
                        batch_tasks[task_id]["progress"] = progress
                        if result["success"]:
                            batch_tasks[task_id]["results"].append(
                                {"name": result["name"], "content": result["content"]}
                            )
                            batch_tasks[task_id]["logs"].append(
                                f"[SUCCESS] 处理成功: {result['name']}"
                            )
                        else:
                            batch_tasks[task_id]["errors"].append(result["error"])
                            batch_tasks[task_id]["logs"].append(
                                f"[ERROR] 处理失败: {result['name']} - {result['error']}"
                            )
                    except Exception as e:
                        batch_tasks[task_id]["errors"].append(str(e))
                        batch_tasks[task_id]["logs"].append(
                            f"[ERROR] 处理超时或异常: {args_list[i][0].get('name', 'unknown')}"
                        )
            batch_tasks[task_id]["status"] = "completed"
            batch_tasks[task_id]["progress"] = 100
            batch_tasks[task_id][
                "status_text"
            ] = f"处理完成！成功: {len(batch_tasks[task_id]['results'])}, 失败: {len(batch_tasks[task_id]['errors'])}"

        executor.submit(run_batch_async)
        return jsonify({"task_id": task_id})
    except Exception as e:
        logger.error(f"启动批量转换失败: {e}", exc_info=True)
        return jsonify({"error": f"启动批量转换失败: {str(e)}"}), 500


@app.route("/api/upload", methods=["POST"])
def upload_file():
    try:
        if "file" not in request.files:
            return jsonify({"error": "没有文件被上传"}), 400
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "没有选择文件"}), 400
        filename = file.filename.lower()
        file_content = file.read()
        if filename.endswith(".txt"):
            content = file_content.decode("utf-8")
        elif filename.endswith(".docx"):
            content = file_converter.docx_to_text(file_content)
        elif filename.endswith(".md"):
            content = file_converter.markdown_to_text(file_content.decode("utf-8"))
        else:
            return (
                jsonify({"error": "不支持的文件格式，请上传 .txt, .docx 或 .md 文件"}),
                400,
            )
        return jsonify({"content": content})
    except Exception as e:
        logger.error(f"文件上传失败: {e}")
        return jsonify({"error": f"文件上传失败: {str(e)}"}), 500


@app.route("/api/download", methods=["POST"])
def download_result():
    try:
        data = request.get_json()
        content = data.get("content", "")
        filename = data.get("filename", "result.json")
        temp_file = tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
        )
        temp_file.write(content)
        temp_file.close()
        return send_file(
            temp_file.name,
            as_attachment=True,
            download_name=secure_filename(filename),
            mimetype="application/json",
        )
    except Exception as e:
        logger.error(f"文件下载失败: {e}")
        return jsonify({"error": f"文件下载失败: {str(e)}"}), 500


@app.route("/api/config", methods=["GET"])
def get_config():
    try:
        return jsonify(
            {
                "character_mapping": config_manager.get_character_mapping(),
                "parsing_config": config_manager.get_parsing_config(),
                "quotes_config": config_manager.get_quotes_config(),
            }
        )
    except Exception as e:
        logger.error(f"获取配置失败: {e}", exc_info=True)
        return jsonify({"error": f"获取配置失败: {str(e)}"}), 500


# update_config()用于把更新后的配置写回config.yaml
# 用户修改的配置保存在浏览器的localStorage中，不再使用这个函数
# @app.route("/api/config", methods=["POST"])
# def update_config():
#     try:
#         data = request.get_json()
#         character_mapping = data.get("character_mapping", {})
#         validated_mapping = {}
#         for name, ids in character_mapping.items():
#             if isinstance(ids, list) and all(isinstance(id_, int) for id_ in ids):
#                 validated_mapping[name] = ids
#         config_manager.update_character_mapping(validated_mapping)

#         return jsonify({"message": "配置更新成功"})
#     except Exception as e:
#         logger.error(f"配置更新失败: {e}")
#         return jsonify({"error": f"配置更新失败: {str(e)}"}), 500


@app.route("/api/costumes", methods=["GET"])
def get_costumes():
    try:
        return jsonify(
            {
                "available_costumes": config_manager.get_available_costumes(),
                "default_costumes": config_manager.get_costume_mapping(),
            }
        )
    except Exception as e:
        logger.error(f"获取服装配置失败: {e}", exc_info=True)
        return jsonify({"error": f"获取服装配置失败: {str(e)}"}), 500


@app.route("/api/update", methods=["POST"])
def update():
    try:
        # 检查git仓库状态
        fetch_result = subprocess.run(["git", "fetch"], capture_output=True, text=True)
        if fetch_result.returncode != 0:
            logger.error(f"Git fetch failed: {fetch_result.stderr}")
            return jsonify({"status": "error", "message": f"Git fetch 失败: {fetch_result.stderr}"}), 500

        status_result = subprocess.run(
            ["git", "status", "-uno"], capture_output=True, text=True, check=True
        )
        status_output = status_result.stdout

        if "Your branch is up to date" in status_output:
            return jsonify({"status": "up_to_date", "message": "当前已是最新版本。"})

        if "Your branch is behind" in status_output or "have diverged" in status_output:
            # Forcing update to the latest version of the remote branch
            branch_result = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], capture_output=True, text=True, check=True)
            branch_name = branch_result.stdout.strip()
            
            # Stash local changes to be safe, especially for untracked files that might be part of the update
            subprocess.run(["git", "stash", "save", "Auto-stashed before force update"], capture_output=True)

            reset_result = subprocess.run(
                ["git", "reset", "--hard", f"origin/{branch_name}"], capture_output=True, text=True, check=True
            )
            
            # Clean untracked files and directories that might have been pulled
            clean_result = subprocess.run(
                ["git", "clean", "-fd"], capture_output=True, text=True, check=True
            )

            logger.info(f"Git reset successful: {reset_result.stdout}")
            logger.info(f"Git clean successful: {clean_result.stdout}")

            # Schedule a restart to apply changes
            def restart_server():
                logger.info("Restarting server to apply updates...")
                
                def _restart():
                    import time
                    time.sleep(1)  # Give client time to receive response
                    os.execv(sys.executable, [sys.executable] + sys.argv)
                
                restart_thread = threading.Thread(target=_restart)
                restart_thread.daemon = True
                restart_thread.start()

            restart_server()
            
            return jsonify({"status": "success", "message": "更新成功！服务器正在重启，请稍后手动刷新页面。"})

        else:
            return jsonify(
                {"status": "unknown", "message": "无法自动更新。您的本地分支与远程分支有差异，但不是简单的落后。建议手动处理。"}
            )

    except FileNotFoundError:
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "错误：'git' 命令未找到。请确保 Git 已经安装并配置在系统的 PATH 中。",
                }
            ),
            500,
        )
    except subprocess.CalledProcessError as e:
        error_message = e.stderr or e.stdout
        logger.error(f"Git command failed: {error_message}")
        return (
            jsonify({"status": "error", "message": f"执行 git 命令失败: {error_message}"}),
            500,
        )
    except Exception as e:
        logger.error(f"检查更新失败: {e}", exc_info=True)
        return (
            jsonify(
                {"status": "error", "message": f"检查更新时发生未知错误: {str(e)}"}
            ),
            500,
        )


if __name__ == "__main__":

    def open_browser():
        webbrowser.open_new("http://127.0.0.1:5000")
    threading.Timer(1, open_browser).start()
    app.run(debug=False, host="0.0.0.0", port=5000)
