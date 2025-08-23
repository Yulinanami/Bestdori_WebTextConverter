# 启动服务器
import multiprocessing
import threading
import webbrowser
import atexit
from waitress import serve
from src.app import create_app

app = create_app()


def cleanup():
    print("正在关闭执行器...")
    executor = app.config.get("EXECUTOR")
    batch_processor = app.config.get("BATCH_PROCESSOR")
    if executor:
        executor.shutdown(wait=True)
    if batch_processor and hasattr(batch_processor, "process_pool"):
        batch_processor.process_pool.shutdown(wait=True, cancel_futures=True)
    print("执行器已关闭。")


def open_browser():
    webbrowser.open_new("http://127.0.0.1:5000")


atexit.register(cleanup)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    threading.Timer(1, open_browser).start()
    print("Starting server with waitress, listening on http://0.0.0.0:5000")
    serve(app, host="0.0.0.0", port=5000, threads=8)
