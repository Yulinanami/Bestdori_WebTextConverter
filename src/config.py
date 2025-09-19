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
        if not self.config_path.exists():
            logger.error(f"配置文件不存在: {self.config_path}。将使用空配置。")
            return {}

        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                config_data = yaml.safe_load(f) or {}
                if not isinstance(config_data, dict):
                    logger.error(
                        f"配置文件 {self.config_path} 顶层不是一个有效的字典。将使用空配置。"
                    )
                    return {}
                return config_data
        except yaml.YAMLError as e:
            logger.error(f"配置文件 {self.config_path} 格式错误: {e}。将使用空配置。")
            return {}
        except Exception as e:
            logger.error(
                f"加载配置文件时发生未知错误: {e}。将使用空配置。", exc_info=True
            )
            return {}

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

    def get_character_motions(self) -> Dict[int, List[str]]:
        return self.config.get("character_motions", {})

    def get_character_expressions(self) -> Dict[int, List[str]]:
        return self.config.get("character_expressions", {})
