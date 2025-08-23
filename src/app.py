import os
from concurrent.futures import ThreadPoolExecutor
from flask import Flask, render_template
from .config import ConfigManager
from .utils import FileFormatConverter
from .batch import OptimizedBatchProcessor
from .routes import all_blueprints


def create_app():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_folder = os.path.join(project_root, "templates")
    static_folder = os.path.join(project_root, "static")
    app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
    app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
    app.config["CONFIG_MANAGER"] = ConfigManager()
    app.config["FILE_CONVERTER"] = FileFormatConverter()
    app.config["BATCH_PROCESSOR"] = OptimizedBatchProcessor()
    app.config["BATCH_TASKS"] = {}
    executor = ThreadPoolExecutor(max_workers=2)
    app.config["EXECUTOR"] = executor
    for bp in all_blueprints:
        app.register_blueprint(bp)

    @app.route("/")
    def index():
        return render_template("index.html")

    return app
