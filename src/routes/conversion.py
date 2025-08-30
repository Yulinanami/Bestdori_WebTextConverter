# 文本转换api
import tempfile
import logging
from ..converter import ProjectConverter 
from flask import Blueprint, request, jsonify, send_file, current_app
from werkzeug.utils import secure_filename

logger = logging.getLogger(__name__)
conversion_bp = Blueprint("conversion", __name__, url_prefix="/api")

@conversion_bp.route("/convert", methods=["POST"])
def convert_project(): # 函数名可以改得更贴切
    try:
        data = request.get_json()
        project_file = data.get("projectFile")

        if not project_file or not isinstance(project_file, dict):
            return jsonify({"error": "无效的项目文件"}), 400
        
        # 使用新的转换器
        converter = ProjectConverter()
        result = converter.convert(project_file)

        return jsonify({"result": result})
    except Exception as e:
        logger.error(f"项目文件转换失败: {e}", exc_info=True)
        return jsonify({"error": f"转换失败: {str(e)}"}), 500


@conversion_bp.route("/upload", methods=["POST"])
def upload_file():
    file_converter = current_app.config["FILE_CONVERTER"]
    try:
        if "file" not in request.files:
            return jsonify({"error": "没有文件被上传"}), 400
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "没有选择文件"}), 400
        
        filename = file.filename
        file_content = file.read()
        
        content = file_converter.read_file_content_to_text(filename, file_content)
        
        return jsonify({"content": content})
    except ValueError as e:
        logger.error(f"文件处理失败: {e}")
        return jsonify({"error": f"文件处理失败: {str(e)}"}), 400
    except Exception as e:
        logger.error(f"文件上传失败: {e}", exc_info=True)
        return jsonify({"error": f"文件上传失败: {str(e)}"}), 500


@conversion_bp.route("/download", methods=["POST"])
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
    
@conversion_bp.route("/segment-text", methods=["POST"])
def segment_text():
    """
    接收原始文本，按空行分割成段落数组。
    """
    try:
        data = request.get_json()
        raw_text = data.get("text", "")
        
        # 使用 splitlines() 和 filter() 来处理各种换行符并移除空行
        lines = raw_text.splitlines()
        segments = []
        current_segment = []

        for line in lines:
            stripped_line = line.strip()
            if stripped_line:
                current_segment.append(stripped_line)
            else:
                if current_segment:
                    segments.append("\n".join(current_segment))
                    current_segment = []
        
        if current_segment: # 添加最后一个片段
            segments.append("\n".join(current_segment))

        return jsonify({"segments": segments})
    except Exception as e:
        logger.error(f"文本分段失败: {e}", exc_info=True)
        return jsonify({"error": f"文本分段失败: {str(e)}"}), 500