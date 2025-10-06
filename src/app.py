# 主应用
import os
import logging
from flask import Flask, render_template, request
from .config import ConfigManager
from .utils import FileFormatConverter
from .routes import all_blueprints

logger = logging.getLogger(__name__)


def create_app():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_folder = os.path.join(project_root, "templates")
    static_folder = os.path.join(project_root, "static")
    app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
    app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
    app.config["CONFIG_MANAGER"] = ConfigManager()
    app.config["FILE_CONVERTER"] = FileFormatConverter()

    # 注册所有蓝图
    for bp in all_blueprints:
        app.register_blueprint(bp)
        logger.info(f"已注册蓝图: {bp.name} (前缀: {bp.url_prefix or '/'})")

    # 请求前日志
    @app.before_request
    def log_request_info():
        logger.debug(f"收到请求: {request.method} {request.path}")
        if request.method == "POST" and request.content_type and "application/json" in request.content_type:
            try:
                logger.debug(f"请求数据: {request.json}")
            except:
                pass

    # 响应后日志
    @app.after_request
    def log_response_info(response):
        logger.debug(f"响应状态: {response.status_code} - {request.method} {request.path}")
        return response

    @app.route("/")
    def index():
        return render_template("index.html")

    return app
