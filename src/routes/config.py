# 配置相关api
import logging
from flask import Blueprint, jsonify, current_app

logger = logging.getLogger(__name__)
config_bp = Blueprint("config", __name__, url_prefix="/api")


@config_bp.route("/config", methods=["GET"])
def get_config():
    config_manager = current_app.config["CONFIG_MANAGER"]
    try:
        logger.info("收到配置加载请求")
        config_data = {
            "character_mapping": config_manager.get_character_mapping(),
            "parsing_config": config_manager.get_parsing_config(),
            "quotes_config": config_manager.get_quotes_config(),
            "character_motions": config_manager.get_character_motions(),
            "character_expressions": config_manager.get_character_expressions(),
            "avatar_mapping": config_manager.get_avatar_mapping(),
        }
        logger.info(f"配置加载成功 - 包含 {len(config_data)} 个配置项")
        return jsonify(config_data)
    except Exception as e:
        logger.error(f"获取配置失败: {e}", exc_info=True)
        return jsonify({"error": f"获取配置失败: {str(e)}"}), 500


@config_bp.route("/costumes", methods=["GET"])
def get_costumes():
    config_manager = current_app.config["CONFIG_MANAGER"]
    try:
        logger.info("收到服装配置加载请求")
        costume_data = {
            "available_costumes": config_manager.get_available_costumes(),
            "default_costumes": config_manager.get_costume_mapping(),
        }
        logger.info("服装配置加载成功")
        return jsonify(costume_data)
    except Exception as e:
        logger.error(f"获取服装配置失败: {e}", exc_info=True)
        return jsonify({"error": f"获取服装配置失败: {str(e)}"}), 500
