# 文本转换api
import tempfile
import logging
from ..converter import ProjectConverter
from flask import Blueprint, request, jsonify, send_file, current_app
from werkzeug.utils import secure_filename

logger = logging.getLogger(__name__)
conversion_bp = Blueprint("conversion", __name__, url_prefix="/api")


@conversion_bp.route("/convert", methods=["POST"])
def convert_project():
    try:
        data = request.get_json()
        project_file = data.get("projectFile")
        quote_config = data.get("quoteConfig")
        narrator_name = data.get("narratorName", " ")
        append_spaces = data.get("appendSpaces", 0)
        append_spaces_before_newline = data.get("appendSpacesBeforeNewline", 0) # 获取新参数

        if not project_file or not isinstance(project_file, dict):
            if data.get("text") is not None:
                logger.warning("API不匹配，客户端使用旧版本接口")
                return jsonify({"error": "API不匹配，请刷新页面或清除缓存。"}), 400
            logger.warning("无效的项目文件")
            return jsonify({"error": "无效的项目文件"}), 400

        logger.info(
            f"开始转换项目 - 旁白名称: '{narrator_name}', 结尾空格: {append_spaces}"
        )
        converter = ProjectConverter()
        result = converter.convert(
            project_file,
            quote_config,
            narrator_name,
            append_spaces,
            append_spaces_before_newline,
        )
        logger.info(f"项目转换成功 - 生成JSON长度: {len(result)} 字符")
        return jsonify({"result": result})
    except Exception as e:
        logger.error(f"项目文件转换失败: {e}", exc_info=True)
        return jsonify({"error": f"转换失败: {str(e)}"}), 500


@conversion_bp.route("/upload", methods=["POST"])
def upload_file():
    file_converter = current_app.config["FILE_CONVERTER"]
    try:
        logger.info("收到文件上传请求")

        if "file" not in request.files:
            logger.warning("request.files 中没有 'file' 字段")
            return jsonify({"error": "没有文件被上传"}), 400

        file = request.files["file"]
        if file.filename == "":
            logger.warning("文件名为空")
            return jsonify({"error": "没有选择文件"}), 400

        filename = file.filename
        file_content = file.read()
        file_size_kb = len(file_content) / 1024

        logger.info(f"正在处理文件: {filename} ({file_size_kb:.2f} KB)")

        content = file_converter.read_file_content_to_text(filename, file_content)

        logger.info(f"文件解析成功 - 内容长度: {len(content)} 字符")
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
        logger.info("收到文件下载请求")
        data = request.get_json()
        content = data.get("content", "")
        filename = data.get("filename", "result.json")

        logger.info(f"生成下载文件: {filename} (大小: {len(content)} 字符)")

        temp_file = tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
        )
        temp_file.write(content)
        temp_file.close()

        logger.info(f"文件下载成功: {filename}")
        return send_file(
            temp_file.name,
            as_attachment=True,
            download_name=secure_filename(filename),
            mimetype="application/json",
        )
    except Exception as e:
        logger.error(f"文件下载失败: {e}", exc_info=True)
        return jsonify({"error": f"文件下载失败: {str(e)}"}), 500


@conversion_bp.route("/segment-text", methods=["POST"])
def segment_text():
    try:
        logger.info("收到文本分段请求")
        data = request.get_json()
        raw_text = data.get("text", "")

        logger.info(f"正在分段文本 (长度: {len(raw_text)} 字符)")

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
        if current_segment:
            segments.append("\n".join(current_segment))

        logger.info(f"文本分段完成 - 生成 {len(segments)} 个段落")
        return jsonify({"segments": segments})
    except Exception as e:
        logger.error(f"文本分段失败: {e}", exc_info=True)
        return jsonify({"error": f"文本分段失败: {str(e)}"}), 500
