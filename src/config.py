# 配置管理器
import os
import yaml
import logging
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


class ConfigManager:
    def __init__(self, config_path: str = "config.yaml"):
        if not os.path.isabs(config_path):
            config_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))), config_path
            )
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
                # It's MyGO
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
                # Ave Mujica
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
