# Flask 主应用（负责创建 app、注册路由、处理请求）
import os
import logging
import signal
from flask import Flask, render_template, request, jsonify
from .config import ConfigManager
from .utils import FileFormatConverter
from .routes import all_blueprints

logger = logging.getLogger(__name__)


# 创建并配置 Flask 应用实例
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

    # 提供一个接口：收到请求后安全退出服务器进程
    @app.route('/api/shutdown', methods=['POST'])
    def shutdown():
        logger.info("收到关闭服务器的请求...")
        try:
            # 获取当前进程的ID
            pid = os.getpid()
            # 发送SIGINT信号，这等同于在终端中按 Ctrl+C
            os.kill(pid, signal.SIGINT)
            logger.info(f"已向进程 {pid} 发送关闭信号。")
            return jsonify({"message": "服务器正在关闭..."}), 200
        except Exception as e:
            logger.error(f"关闭服务器时出错: {e}", exc_info=True)
            return jsonify({"error": str(e)}), 500

    # 在每个请求开始前打印基本信息
    @app.before_request
    def log_request_info():
        logger.debug(f"收到请求: {request.method} {request.path}")
        if request.method == "POST" and request.content_type and "application/json" in request.content_type:
            try:
                logger.debug(f"请求数据: {request.json}")
            except:
                pass

    # 在每个请求结束后打印响应状态码
    @app.after_request
    def log_response_info(response):
        logger.debug(f"响应状态: {response.status_code} - {request.method} {request.path}")
        return response

    # 首页：返回前端页面
    @app.route("/")
    def index():
        return render_template("index.html")

    return app
