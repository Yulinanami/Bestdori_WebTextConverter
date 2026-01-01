# 配置管理器（读取/保存 config.yaml，并提供便捷的取值方法）
import os
import yaml
import logging
from pathlib import Path
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


class ConfigManager:
    # 初始化：确定配置文件路径并加载到内存
    def __init__(self, config_path: str = "config.yaml"):
        if not os.path.isabs(config_path):
            config_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))), config_path
            )
        self.config_path = Path(config_path)
        self.config = self._load_config()
        logger.info(f"ConfigManager using config file: {self.config_path}")

    # 从 YAML 文件读取配置（读不到就返回空字典）
    def _load_config(self) -> Dict[str, Any]:
        if not self.config_path.exists():
            logger.error(f"配置文件不存在: {self.config_path}。将使用空配置。")
            return {}

        try:
            logger.info(f"正在加载配置文件: {self.config_path}")
            with open(self.config_path, "r", encoding="utf-8") as f:
                config_data = yaml.safe_load(f) or {}
                if not isinstance(config_data, dict):
                    logger.error(
                        f"配置文件 {self.config_path} 顶层不是一个有效的字典。将使用空配置。"
                    )
                    return {}
                logger.info(f"配置文件加载成功 - 包含 {len(config_data)} 个顶级配置项")
                return config_data
        except yaml.YAMLError as e:
            logger.error(f"配置文件 {self.config_path} 格式错误: {e}。将使用空配置。")
            return {}
        except Exception as e:
            logger.error(
                f"加载配置文件时发生未知错误: {e}。将使用空配置。", exc_info=True
            )
            return {}

    # 把配置写回 YAML 文件（暂时无用）
    def _save_config(self, config: Dict[str, Any]):
        try:
            logger.info(f"正在保存配置文件: {self.config_path}")
            with open(self.config_path, "w", encoding="utf-8") as f:
                yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
            logger.info("配置文件保存成功")
        except Exception as e:
            logger.error(f"配置文件保存失败: {e}", exc_info=True)

    # 获取“角色名 -> 角色ID列表”的映射
    def get_character_mapping(self) -> Dict[str, List[int]]:
        return self.config.get("character_mapping", {})

    # 获取解析相关配置（比如是否启用某些规则）
    def get_parsing_config(self) -> Dict[str, Any]:
        return self.config.get("parsing", {})

    # 获取文本匹配用的正则/关键字配置
    def get_patterns(self) -> Dict[str, str]:
        return self.config.get("patterns", {})

    # 获取引号处理配置（用于去掉文本两端引号）
    def get_quotes_config(self) -> Dict[str, Any]:
        return self.config.get("quotes", {})

    # 获取“角色ID -> 默认服装名”的映射
    def get_costume_mapping(self) -> Dict[int, str]:
        return self.config.get("default_costumes", {})

    # 获取“角色ID -> 可选服装列表”的映射
    def get_available_costumes(self) -> Dict[int, List[str]]:
        return self.config.get("costume_mapping", {})

    # 获取“角色ID -> 可用动作列表”的映射
    def get_character_motions(self) -> Dict[int, List[str]]:
        return self.config.get("character_motions", {})

    # 获取“角色ID -> 可用表情列表”的映射
    def get_character_expressions(self) -> Dict[int, List[str]]:
        return self.config.get("character_expressions", {})

    # 获取“角色ID -> 头像ID”的映射
    def get_avatar_mapping(self) -> Dict[int, int]:
        return self.config.get("avatar_mapping", {})
