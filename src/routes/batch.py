import uuid
import logging
import threading
from concurrent.futures import as_completed
from ..batch import batch_worker
from flask import Blueprint, request, jsonify, current_app

logger = logging.getLogger(__name__)
batch_bp = Blueprint("batch", __name__, url_prefix="/api/batch_convert")


@batch_bp.route("/start", methods=["POST"])
def start_batch_conversion():
    batch_tasks = current_app.config["BATCH_TASKS"]
    executor = current_app.config["EXECUTOR"]
    batch_processor = current_app.config["BATCH_PROCESSOR"]
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


@batch_bp.route("/status/<task_id>", methods=["GET"])
def get_batch_status(task_id):
    batch_tasks = current_app.config["BATCH_TASKS"]
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
