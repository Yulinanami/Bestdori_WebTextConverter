# 文件合并 API（接收前端传来的多个 JSON 文件数据，在后端执行合并逻辑）
import json
import time
import random
import copy
import logging
from collections import OrderedDict
from flask import Blueprint, request, make_response

logger = logging.getLogger(__name__)
merger_bp = Blueprint("merger", __name__, url_prefix="/api")


def _generate_timestamp():
    """生成一个带随机偏移的时间戳，用于生成唯一 ID"""
    return int(time.time() * 1000) + random.randint(0, 9999)


def _ordered_json_response(data, status=200):
    """返回保持键顺序的 JSON 响应（不使用 jsonify 避免自动排序）"""
    response = make_response(
        json.dumps(data, ensure_ascii=False, indent=2, sort_keys=False),
        status,
    )
    response.headers["Content-Type"] = "application/json; charset=utf-8"
    return response


def _merge_bestdori(files):
    """
    合并 Bestdori 转换结果文件：
    严格按照 server → voice → background → bgm → actions 的顺序输出。
    """
    base = files[0]["data"]
    merged = OrderedDict(
        [
            ("server", base.get("server", 0)),
            ("voice", base.get("voice", "")),
            ("background", base.get("background")),
            ("bgm", base.get("bgm")),
            ("actions", []),
        ]
    )

    for file_entry in files:
        actions = file_entry["data"].get("actions", [])
        merged["actions"].extend(actions)

    return merged


def _merge_project(files):
    """
    合并编辑进度文件：
    严格按照 version → actions 的顺序输出，
    深拷贝所有 actions 并重新生成唯一 ID 以避免冲突。
    """
    base = files[0]["data"]
    merged = OrderedDict(
        [
            ("version", base.get("version", "1.0")),
            ("actions", []),
        ]
    )

    for file_entry in files:
        cloned_actions = copy.deepcopy(file_entry["data"].get("actions", []))

        for index, action in enumerate(cloned_actions):
            timestamp = _generate_timestamp() + index
            action_type = action.get("type", "")

            if action_type == "talk":
                action["id"] = f"action-id-{timestamp}-{index}"
            elif action_type == "layout":
                char_id = action.get("characterId", 0)
                action["id"] = f"layout-action-{timestamp}-{char_id}-{index}"
            else:
                action["id"] = f"action-{timestamp}-{index}"

        merged["actions"].extend(cloned_actions)

    return merged


@merger_bp.route("/merge", methods=["POST"])
def merge_files():
    """接收前端传来的文件数据列表和模式，执行合并并返回结果"""
    try:
        data = request.get_json()
        mode = data.get("mode")
        files = data.get("files")

        if not files or not isinstance(files, list) or len(files) < 1:
            return _ordered_json_response({"error": "请至少提供一个文件"}, 400)

        if mode not in ("bestdori", "project"):
            return _ordered_json_response({"error": f"不支持的合并模式: {mode}"}, 400)

        # 校验每个文件都包含 actions 数组
        for file_entry in files:
            file_data = file_entry.get("data")
            if not file_data or not isinstance(file_data.get("actions"), list):
                file_name = file_entry.get("name", "未知文件")
                return _ordered_json_response(
                    {"error": f"文件 {file_name} 格式不正确，缺少 actions 数组"}, 400
                )

        logger.info(f"开始合并文件 - 模式: {mode}, 文件数量: {len(files)}")

        if mode == "bestdori":
            result = _merge_bestdori(files)
        else:
            result = _merge_project(files)

        logger.info(f"文件合并成功 - 合并后 actions 数量: {len(result['actions'])}")
        return _ordered_json_response({"result": result})

    except Exception as e:
        logger.error(f"文件合并失败: {e}", exc_info=True)
        return _ordered_json_response({"error": f"文件合并失败: {str(e)}"}, 500)
