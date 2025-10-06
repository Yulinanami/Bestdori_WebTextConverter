# 启动服务器
import multiprocessing
import threading
import webbrowser
import atexit
import logging
from waitress import serve
from src.app import create_app

# 配置根日志记录器
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - [%(levelname)s] - %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)

# 设置第三方库的日志级别为 WARNING，避免过多输出
logging.getLogger("waitress").setLevel(logging.WARNING)
logging.getLogger("werkzeug").setLevel(logging.WARNING)

# 确保项目模块的日志级别为 DEBUG
logging.getLogger("src").setLevel(logging.DEBUG)

logger = logging.getLogger(__name__)

app = create_app()


def cleanup():
    logger.info("服务器正在关闭...")
    logger.info("清理完成。")


def open_browser():
    logger.info("正在打开浏览器: http://127.0.0.1:5000")
    webbrowser.open_new("http://127.0.0.1:5000")


atexit.register(cleanup)


if __name__ == "__main__":
    multiprocessing.freeze_support()

    # 打印启动横幅
    logger.info("="*60)
    logger.info("文本转JSON转换器服务器启动中...")
    logger.info("监听地址: http://0.0.0.0:5000")
    logger.info("本地访问: http://127.0.0.1:5000")
    logger.info("线程数: 8")
    logger.info("="*60)

    threading.Timer(1, open_browser).start()
    serve(app, host="0.0.0.0", port=5000, threads=8)
