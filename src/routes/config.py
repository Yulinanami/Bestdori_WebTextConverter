# 配置相关api
import logging
from flask import Blueprint, jsonify, current_app

logger = logging.getLogger(__name__)
config_bp = Blueprint("config", __name__, url_prefix="/api")


@config_bp.route("/config", methods=["GET"])
def get_config():
    config_manager = current_app.config['CONFIG_MANAGER']
    try:
        return jsonify(
            {
                "character_mapping": config_manager.get_character_mapping(),
                "parsing_config": config_manager.get_parsing_config(),
                "quotes_config": config_manager.get_quotes_config(),
                "character_motions": config_manager.get_character_motions(),
                "character_expressions": config_manager.get_character_expressions(),
            }
        )
    except Exception as e:
        logger.error(f"获取配置失败: {e}", exc_info=True)
        return jsonify({"error": f"获取配置失败: {str(e)}"}), 500


@config_bp.route("/costumes", methods=["GET"])
def get_costumes():
    config_manager = current_app.config['CONFIG_MANAGER']
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
