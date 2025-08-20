# API路由管理
import os
import uuid
import logging
import atexit
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename
from .config import ConfigManager
from .converter import TextConverter
from .utils import FileFormatConverter
from .batch import batch_worker, OptimizedBatchProcessor

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
logger = logging.getLogger(__name__)
template_folder = os.path.join(project_root, "templates")
static_folder = os.path.join(project_root, "static")
app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

config_manager = ConfigManager()
file_converter = FileFormatConverter()
batch_processor = OptimizedBatchProcessor()
batch_tasks = {}
executor = ThreadPoolExecutor(max_workers=2)


def cleanup_executors():
    print("正在关闭执行器...")
    executor.shutdown(wait=True)
    batch_processor.process_pool.shutdown(wait=True, cancel_futures=True)
    print("执行器已关闭。")


atexit.register(cleanup_executors)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/convert", methods=["POST"])
def convert_text():
    try:
        data = request.get_json()
        input_text = data.get("text", "")
        narrator_name = data.get("narrator_name", " ")
        selected_pairs = data.get("selected_quote_pairs", [])
        custom_character_mapping = data.get("character_mapping", None)
        enable_live2d = data.get("enable_live2d", False)
        custom_costume_mapping = data.get("costume_mapping", None)
        position_config = data.get("position_config", None)
        if custom_costume_mapping:
            fixed_costume_mapping = {}
            for str_key, value in custom_costume_mapping.items():
                try:
                    int_key = int(str_key)
                    fixed_costume_mapping[int_key] = value
                except ValueError:
                    fixed_costume_mapping[str_key] = value
            custom_costume_mapping = fixed_costume_mapping
            logger.info(f"修复后的服装映射: {custom_costume_mapping}")
        if not input_text.strip():
            return jsonify({"error": "输入文本不能为空"}), 400
        request_converter = TextConverter(config_manager)
        if custom_character_mapping:
            request_converter.character_mapping = custom_character_mapping
        result = request_converter.convert_text_to_json_format(
            input_text,
            narrator_name,
            selected_pairs,
            enable_live2d,
            custom_costume_mapping,
            position_config,
        )
        return jsonify({"result": result})
    except Exception as e:
        logger.error(f"转换失败: {e}", exc_info=True)
        return jsonify({"error": f"转换失败: {str(e)}"}), 500


@app.route("/api/batch_convert/status/<task_id>", methods=["GET"])
def get_batch_status(task_id):
    task = batch_tasks.get(task_id)
    if not task:
        return jsonify({"error": "未找到该任务"}), 404
    response_data = {
        "status": task["status"],
        "progress": task["progress"],
        "status_text": task["status_text"],
        "logs": task["logs"],
    }
    if task["status"] == "completed":
        response_data["results"] = task["results"]
        response_data["errors"] = task["errors"]
        threading.Timer(300, lambda: batch_tasks.pop(task_id, None)).start()
    return jsonify(response_data)


@app.route("/api/batch_convert/start", methods=["POST"])
def start_batch_conversion():
    try:
        data = request.get_json()
        files_data = data.get("files", [])
        if not files_data:
            return jsonify({"error": "没有提供任何文件"}), 400
        converter_config = {
            "narrator_name": data.get("narrator_name", " "),
            "selected_quote_pairs": data.get("selected_quote_pairs", []),
            "character_mapping": data.get("character_mapping"),
            "enable_live2d": data.get("enable_live2d", False),
            "custom_costume_mapping": data.get("costume_mapping"),
            "position_config": data.get("position_config"),
        }
        task_id = str(uuid.uuid4())

        def run_in_background():
            batch_tasks[task_id] = {
                "status": "running",
                "progress": 0,
                "status_text": "正在准备...",
                "logs": ["INFO: 任务已开始，正在分配进程..."],
                "results": [],
                "errors": [],
            }
            total_files = len(files_data)
            args_list = [(file_data, converter_config) for file_data in files_data]
            processed_files = 0
            try:
                future_to_original_name = {
                    batch_processor.process_pool.submit(batch_worker, arg): arg[0].get(
                        "name", "unknown"
                    )
                    for arg in args_list
                }
                for future in as_completed(future_to_original_name):
                    original_name = future_to_original_name[future]
                    try:
                        result = future.result(timeout=60)
                        if result["success"]:
                            batch_tasks[task_id]["results"].append(
                                {"name": result["name"], "content": result["content"]}
                            )
                            batch_tasks[task_id]["logs"].append(
                                f"[SUCCESS] 处理成功: {result['original_name']}"
                            )
                        else:
                            error_message = (
                                f"处理失败: {result['name']} - {result['error']}"
                            )
                            batch_tasks[task_id]["errors"].append(error_message)
                            batch_tasks[task_id]["logs"].append(
                                f"[ERROR] {error_message}"
                            )
                    except Exception as exc:
                        error_message = f"处理文件 {original_name} 时发生异常: {exc}"
                        logger.error(error_message, exc_info=True)
                        batch_tasks[task_id]["errors"].append(error_message)
                        batch_tasks[task_id]["logs"].append(f"[ERROR] {error_message}")
                    processed_files += 1
                    progress = (processed_files / total_files) * 100
                    batch_tasks[task_id]["progress"] = progress
                    batch_tasks[task_id][
                        "status_text"
                    ] = f"处理中... ({processed_files}/{total_files})"
            except Exception as e:
                logger.error(f"批量处理任务 {task_id} 发生严重错误: {e}", exc_info=True)
                batch_tasks[task_id]["errors"].append(f"处理池发生严重错误: {e}")
                batch_tasks[task_id]["logs"].append(f"[FATAL] 任务意外终止: {e}")
            batch_tasks[task_id]["status"] = "completed"
            batch_tasks[task_id]["progress"] = 100
            final_status_text = f"处理完成！成功: {len(batch_tasks[task_id]['results'])}, 失败: {len(batch_tasks[task_id]['errors'])}"
            batch_tasks[task_id]["status_text"] = final_status_text
            batch_tasks[task_id]["logs"].append(f"INFO: {final_status_text}")

        executor.submit(run_in_background)
        return jsonify({"task_id": task_id})
    except Exception as e:
        logger.error(f"启动批量转换失败: {e}", exc_info=True)
        return jsonify({"error": f"启动批量转换失败: {str(e)}"}), 500


@app.route("/api/upload", methods=["POST"])
def upload_file():
    try:
        if "file" not in request.files:
            return jsonify({"error": "没有文件被上传"}), 400
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "没有选择文件"}), 400
        filename = file.filename.lower()
        file_content = file.read()
        if filename.endswith(".txt"):
            content = file_content.decode("utf-8")
        elif filename.endswith(".docx"):
            content = file_converter.docx_to_text(file_content)
        elif filename.endswith(".md"):
            content = file_converter.markdown_to_text(file_content.decode("utf-8"))
        else:
            return (
                jsonify({"error": "不支持的文件格式，请上传 .txt, .docx 或 .md 文件"}),
                400,
            )
        return jsonify({"content": content})
    except Exception as e:
        logger.error(f"文件上传失败: {e}")
        return jsonify({"error": f"文件上传失败: {str(e)}"}), 500


@app.route("/api/download", methods=["POST"])
def download_result():
    try:
        data = request.get_json()
        content = data.get("content", "")
        filename = data.get("filename", "result.json")
        temp_file = tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
        )
        temp_file.write(content)
        temp_file.close()
        return send_file(
            temp_file.name,
            as_attachment=True,
            download_name=secure_filename(filename),
            mimetype="application/json",
        )
    except Exception as e:
        logger.error(f"文件下载失败: {e}")
        return jsonify({"error": f"文件下载失败: {str(e)}"}), 500


@app.route("/api/config", methods=["GET"])
def get_config():
    try:
        return jsonify(
            {
                "character_mapping": config_manager.get_character_mapping(),
                "parsing_config": config_manager.get_parsing_config(),
                "quotes_config": config_manager.get_quotes_config(),
            }
        )
    except Exception as e:
        logger.error(f"获取配置失败: {e}", exc_info=True)
        return jsonify({"error": f"获取配置失败: {str(e)}"}), 500


@app.route("/api/costumes", methods=["GET"])
def get_costumes():
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
