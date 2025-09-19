# 启动服务器
import multiprocessing
import threading
import webbrowser
import atexit
from waitress import serve
from src.app import create_app

app = create_app()


def cleanup():
    print("服务器正在关闭...")
    print("清理完成。")


def open_browser():
    webbrowser.open_new("http://127.0.0.1:5000")


atexit.register(cleanup)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    threading.Timer(1, open_browser).start()
    print("Starting server with waitress, listening on http://0.0.0.0:5000")
    serve(app, host="0.0.0.0", port=5000, threads=8)
