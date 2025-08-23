# run.py (最终版本)

import multiprocessing
import threading
import webbrowser
from waitress import serve
import atexit

# 1. 从 src.app 导入 create_app 工厂函数，而不是 app 实例
from src.app import create_app

def open_browser():
    webbrowser.open_new("http://127.0.0.1:5000")

# 2. 调用工厂函数来创建和获取 app 实例
app = create_app()

# atexit 清理函数需要从 app.config 中获取实例
# 必须在 app 创建之后定义
def cleanup():
    print("正在关闭执行器...")
    # 从 app.config 中安全地获取实例
    executor = app.config.get('EXECUTOR')
    batch_processor = app.config.get('BATCH_PROCESSOR')

    if executor:
        executor.shutdown(wait=True)
    if batch_processor and hasattr(batch_processor, 'process_pool'):
        batch_processor.process_pool.shutdown(wait=True, cancel_futures=True)
    print("执行器已关闭。")

atexit.register(cleanup)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    threading.Timer(1, open_browser).start()
    print("Starting server with waitress, listening on http://0.0.0.0:5000")
    
    # 3. 使用创建好的 app 实例来启动服务
    serve(app, host="0.0.0.0", port=5000, threads=8)