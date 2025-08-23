import tempfile
import logging
from ..converter import TextConverter
from flask import Blueprint, request, jsonify, send_file, current_app
from werkzeug.utils import secure_filename

logger = logging.getLogger(__name__)
conversion_bp = Blueprint("conversion", __name__, url_prefix="/api")


@conversion_bp.route("/convert", methods=["POST"])
def convert_text():
    config_manager = current_app.config["CONFIG_MANAGER"]
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


@conversion_bp.route("/upload", methods=["POST"])
def upload_file():
    file_converter = current_app.config["FILE_CONVERTER"]
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
