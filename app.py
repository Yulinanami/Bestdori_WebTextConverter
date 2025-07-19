from flask import Flask, render_template, request, jsonify, send_file
import json
import re
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod
import yaml
import tempfile
import os
from werkzeug.utils import secure_filename
# --- 新增导入 ---
import uuid
import threading
from concurrent.futures import ThreadPoolExecutor
import markdown2  # 新增：支持Markdown
from docx import Document  # 新增：支持Word文档
import io
import base64  # 新增：用于处理批量上传的二进制文件

project_root = os.path.dirname(os.path.abspath(__file__))
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

template_folder = os.path.join(project_root, 'templates')
static_folder = os.path.join(project_root, 'static')
app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
app.config['UPLOAD_FOLDER'] = '/tmp' 

@dataclass
class ActionItem:
    type: str = "talk"; delay: int = 0; wait: bool = True; characters: List[int] = None; name: str = ""; body: str = ""; motions: List[str] = None; voices: List[str] = None; close: bool = False
    def __post_init__(self):
        if self.characters is None: self.characters = []
        if self.motions is None: self.motions = []
        if self.voices is None: self.voices = []

@dataclass
class ConversionResult:
    server: int = 0; voice: str = ""; background: Optional[str] = None; bgm: Optional[str] = None; actions: List[ActionItem] = None
    def __post_init__(self):
        if self.actions is None: self.actions = []

class ConfigManager:
    def __init__(self, config_path: str = "config.yaml"):
        if not os.path.isabs(config_path):
            config_path = os.path.join(project_root, config_path)
        self.config_path = Path(config_path)
        self.config = self._load_config()
        logger.info(f"ConfigManager using config file: {self.config_path}")

    def _load_config(self) -> Dict[str, Any]:
        # --- 解决方案2：恢复完整的默认角色列表 ---
        default_config = {
            "character_mapping": {
                # Poppin'Party
                "户山香澄": [1], "花园多惠": [2], "牛込里美": [3], "山吹沙绫": [4], "市谷有咲": [5],
                # Afterglow
                "美竹兰": [6], "青叶摩卡": [7], "上原绯玛丽": [8], "宇田川巴": [9], "羽泽鸫": [10],
                # Hello, Happy World!
                "弦卷心": [11], "濑田薰": [12], "北泽育美": [13], "松原花音": [14], "奥泽美咲": [15],
                # Pastel*Palettes
                "丸山彩": [16], "冰川日菜": [17], "白鹭千圣": [18], "大和麻弥": [19], "若宫伊芙": [20],
                # Roselia
                "凑友希那": [21], "冰川纱夜": [22], "今井莉莎": [23], "宇田川亚子": [24], "白金燐子": [25],
                # Morfonica
                "仓田真白": [26], "桐谷透子": [27], "广町七深": [28], "二叶筑紫": [29], "八潮瑠唯": [30],
                # RAISE A SUILEN
                "LAYER": [31], "LOCK": [32], "MASKING": [33], "PAREO": [34], "CHU²": [35],
                # mujica
                "丰川祥子": [1], "若叶睦": [2], "三角初华": [3], "八幡海铃": [4], "祐天寺若麦": [5],
                # MyGo
                "高松灯": [36], "千早爱音": [37], "要乐奈": [38], "长崎素世": [39], "椎名立希": [40]
            },
            "parsing": { "max_speaker_name_length": 50, "default_narrator_name": " " },
            "patterns": { "speaker_pattern": r'^([\w\s]+)\s*[：:]\s*(.*)$' },
            "quotes": {
                "quote_pairs": {'"': '"', "'": "'", "‘": "’", "「": "」", "『": "』"},
                "quote_categories": {
                    "中文引号 \"...\"": ['"', '"'],
                    "中文单引号 '...'": ["'", "'"],
                    "日文引号 「...」": ["「", "」"], "日文书名号 『...』": ["『", "』"],
                    "英文双引号 \"...\"": ['"', '"'], "英文单引号 '...'": ["'", "'"]
                }
            }
        }
        if not self.config_path.exists():
            self._save_config(default_config)
            return default_config
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                loaded_config = yaml.safe_load(f) or default_config
                quotes_section = loaded_config.get("quotes", {})
                if "quote_categories" not in quotes_section or len(quotes_section["quote_categories"]) < 6:
                    logger.warning("旧的或不完整的引号配置，将使用最新的默认配置进行更新。")
                    loaded_config["quotes"] = default_config["quotes"]
                    self._save_config(loaded_config)
                return loaded_config
        except Exception as e:
            logger.warning(f"配置文件加载失败: {e}"); return default_config

    def _save_config(self, config: Dict[str, Any]):
        try:
            with open(self.config_path, 'w', encoding='utf-8') as f:
                yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
        except Exception as e: logger.error(f"配置文件保存失败: {e}")

    def get_character_mapping(self) -> Dict[str, List[int]]: return self.config.get("character_mapping", {})
    def get_parsing_config(self) -> Dict[str, Any]: return self.config.get("parsing", {})
    def get_patterns(self) -> Dict[str, str]: return self.config.get("patterns", {})
    def get_quotes_config(self) -> Dict[str, Any]: return self.config.get("quotes", {})
    def update_character_mapping(self, new_mapping: Dict[str, List[int]]):
        self.config["character_mapping"] = new_mapping; self._save_config(self.config)

# --- 解决方案1：清理代码，只保留新的、正确的解析器类 ---
class DialogueParser(ABC):
    @abstractmethod
    def parse(self, line: str) -> Optional[Tuple[str, str]]: pass

class SpeakerParser(DialogueParser):
    def __init__(self, pattern: str, max_name_length: int):
        self.pattern = re.compile(pattern, re.UNICODE)
        self.max_name_length = max_name_length
    def parse(self, line: str) -> Optional[Tuple[str, str]]:
        match = self.pattern.match(line.strip())
        if match:
            try:
                speaker_name = match.group(1).strip()
                if len(speaker_name) < self.max_name_length:
                    return speaker_name, match.group(2).strip()
            except IndexError:
                return None # 增加一个返回路径，确保健壮性
        return None # 确保所有路径都有返回值

class QuoteHandler:
    def remove_quotes(self, text: str, active_quote_pairs: Dict[str, str]) -> str:
        stripped = text.strip()
        if len(stripped) < 2: return text
        first_char = stripped[0]
        expected_closing = active_quote_pairs.get(first_char)
        if expected_closing and stripped[-1] == expected_closing:
            return stripped[1:-1].strip()
        return text

class TextConverter:
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.character_mapping = config_manager.get_character_mapping()
        self.parsing_config = config_manager.get_parsing_config()
        self.patterns = config_manager.get_patterns()
        self._init_parsers()

    def _init_parsers(self):
        self.parser = SpeakerParser(
            self.patterns.get("speaker_pattern", r'^([\w\s]+)\s*[：:]\s*(.*)$'),
            self.parsing_config.get("max_speaker_name_length", 50)
        )
        self.quote_handler = QuoteHandler()

    def convert_text_to_json_format(self, input_text: str, narrator_name: str, selected_quote_pairs_list: List[List[str]]) -> str:
        active_quote_pairs = {
            pair[0]: pair[1]
            for pair in selected_quote_pairs_list
            if isinstance(pair, list) and len(pair) == 2
        }
        actions = []
        current_action_name = narrator_name
        current_action_body_lines = []
        def finalize_current_action():
            if current_action_body_lines:
                body = "\n".join(current_action_body_lines).strip()
                finalized_body = self.quote_handler.remove_quotes(body, active_quote_pairs)
                if finalized_body:
                    actions.append(ActionItem(
                        characters=self.character_mapping.get(current_action_name, []),
                        name=current_action_name,
                        body=finalized_body
                    ))
        for line in input_text.split('\n'):
            stripped_line = line.strip()
            if not stripped_line:
                finalize_current_action()
                current_action_name = narrator_name
                current_action_body_lines = []
                continue
            parse_result = self.parser.parse(stripped_line)
            if parse_result:
                speaker, content = parse_result
                if speaker != current_action_name and current_action_body_lines:
                    finalize_current_action()
                    current_action_body_lines = []
                current_action_name = speaker
                current_action_body_lines.append(content)
            else:
                current_action_body_lines.append(stripped_line)
        finalize_current_action()
        result = ConversionResult(actions=actions)
        return json.dumps(asdict(result), ensure_ascii=False, indent=2)

# --- 新增：文件格式转换器 ---
class FileFormatConverter:
    @staticmethod
    def docx_to_text(file_content: bytes) -> str:
        """将Word文档转换为纯文本"""
        try:
            doc = Document(io.BytesIO(file_content))
            text_lines = []
            for paragraph in doc.paragraphs:
                if paragraph.text.strip():
                    text_lines.append(paragraph.text.strip())
            return '\n\n'.join(text_lines)
        except Exception as e:
            logger.error(f"Word文档解析失败: {e}")
            raise ValueError(f"无法解析Word文档: {str(e)}")
    
    @staticmethod
    def markdown_to_text(md_content: str) -> str:
        """将Markdown转换为纯文本，保留对话格式"""
        try:
            # 先转换Markdown到HTML
            html = markdown2.markdown(md_content)
            # 移除HTML标签，保留文本
            text = re.sub(r'<[^>]+>', '', html)
            # 处理特殊字符
            text = text.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
            # 清理多余的空行
            lines = [line.strip() for line in text.split('\n') if line.strip()]
            return '\n\n'.join(lines)
        except Exception as e:
            logger.error(f"Markdown解析失败: {e}")
            raise ValueError(f"无法解析Markdown: {str(e)}")

config_manager = ConfigManager()
converter = TextConverter(config_manager)
file_converter = FileFormatConverter()

# --- 新增：任务管理 ---
batch_tasks = {} # 用于存储所有批量任务的状态
executor = ThreadPoolExecutor(max_workers=2) # 线程池，用于在后台执行批量任务

def run_batch_task(task_id: str, files_data: List[Dict[str, str]], narrator_name: str, selected_quote_pairs: List[List[str]]):
    """在后台线程中运行的批量转换函数"""
    import base64
    
    total_files = len(files_data)
    task = batch_tasks[task_id]
    
    for i, file_data in enumerate(files_data):
        filename = file_data.get('name', 'unknown.txt')
        raw_content = file_data.get('content', '')
        encoding = file_data.get('encoding', 'text')
        
        # 更新任务状态
        task['progress'] = (i / total_files) * 100
        task['status_text'] = f"正在处理 ({i+1}/{total_files}): {filename}"
        task['logs'].append(f"[INFO] 开始处理: {filename}")

        try:
            # 根据文件类型和编码处理内容
            text_content = ''
            if encoding == 'base64' and filename.lower().endswith('.docx'):
                # 从 Data URL 中提取 Base64 部分并解码
                content_parts = raw_content.split(',')
                if len(content_parts) > 1:
                    base64_content = content_parts[1]
                    decoded_bytes = base64.b64decode(base64_content)
                    text_content = file_converter.docx_to_text(decoded_bytes)
                else:
                    raise ValueError("无效的 Base64 数据")
            elif filename.lower().endswith('.md'):
                text_content = file_converter.markdown_to_text(raw_content)
            else:  # .txt 或其他文本格式
                text_content = raw_content
            
            # 使用转换后的文本内容进行处理
            json_output = converter.convert_text_to_json_format(text_content, narrator_name, selected_quote_pairs)
            task['results'].append({'name': Path(filename).with_suffix('.json').name, 'content': json_output})
            task['logs'].append(f"[SUCCESS] 处理成功: {filename}")
        except Exception as e:
            error_msg = f"处理失败: {filename} - {e}"
            task['logs'].append(f"[ERROR] {error_msg}")
            task['errors'].append(error_msg)

    task['progress'] = 100
    task['status_text'] = f"处理完成！成功: {len(task['results'])}, 失败: {len(task['errors'])}."
    task['status'] = 'completed'
    task['logs'].append(f"[INFO] {task['status_text']}")

@app.route('/')
def index(): return render_template('index.html')

@app.route('/api/convert', methods=['POST'])
def convert_text():
    try:
        data = request.get_json()
        input_text = data.get('text', '')
        narrator_name = data.get('narrator_name', ' ')
        selected_pairs = data.get('selected_quote_pairs', [])
        if not input_text.strip():
            return jsonify({'error': '输入文本不能为空'}), 400
        result = converter.convert_text_to_json_format(input_text, narrator_name, selected_pairs)
        return jsonify({'result': result})
    except Exception as e:
        logger.error(f"转换失败: {e}", exc_info=True)
        return jsonify({'error': f'转换失败: {str(e)}'}), 500

@app.route('/api/batch_convert/status/<task_id>', methods=['GET'])
def get_batch_status(task_id):
    task = batch_tasks.get(task_id)
    if not task:
        return jsonify({'error': '未找到该任务'}), 404
    
    # 为了减少数据传输，通常只返回状态和进度，结果在完成后一次性获取或分块获取
    response_data = {
        'status': task['status'],
        'progress': task['progress'],
        'status_text': task['status_text'],
        'logs': task['logs']
    }
    
    # 如果任务完成，附上结果
    if task['status'] == 'completed':
        response_data['results'] = task['results']
        response_data['errors'] = task['errors']
        # (可选) 在一段时间后从内存中移除已完成的任务，以防内存泄漏
        threading.Timer(300, lambda: batch_tasks.pop(task_id, None)).start()

    return jsonify(response_data)
# --- 新增：批量处理相关接口 ---
@app.route('/api/batch_convert/start', methods=['POST'])
def start_batch_conversion():
    try:
        data = request.get_json()
        files_data = data.get('files', [])
        narrator_name = data.get('narrator_name', ' ')
        selected_quote_pairs = data.get('selected_quote_pairs', [])

        if not files_data:
            return jsonify({'error': '没有提供任何文件'}), 400

        task_id = str(uuid.uuid4())
        batch_tasks[task_id] = {
            'status': 'running',
            'progress': 0,
            'status_text': '正在准备...',
            'logs': [],
            'results': [],
            'errors': []
        }

        # 使用线程池在后台执行任务
        executor.submit(run_batch_task, task_id, files_data, narrator_name, selected_quote_pairs)
        
        return jsonify({'task_id': task_id})
    except Exception as e:
        logger.error(f"启动批量转换失败: {e}", exc_info=True)
        return jsonify({'error': f'启动批量转换失败: {str(e)}'}), 500

@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有文件被上传'}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400
        
        filename = file.filename.lower()
        file_content = file.read()
        
        # 根据文件类型处理
        if filename.endswith('.txt'):
            content = file_content.decode('utf-8')
        elif filename.endswith('.docx'):
            content = file_converter.docx_to_text(file_content)
        elif filename.endswith('.md'):
            content = file_converter.markdown_to_text(file_content.decode('utf-8'))
        else:
            return jsonify({'error': '不支持的文件格式，请上传 .txt, .docx 或 .md 文件'}), 400
        
        return jsonify({'content': content})
    except Exception as e:
        logger.error(f"文件上传失败: {e}")
        return jsonify({'error': f'文件上传失败: {str(e)}'}), 500

@app.route('/api/download', methods=['POST'])
def download_result():
    try:
        data = request.get_json(); content = data.get('content', ''); filename = data.get('filename', 'result.json')
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8')
        temp_file.write(content); temp_file.close()
        return send_file(temp_file.name, as_attachment=True, download_name=secure_filename(filename), mimetype='application/json')
    except Exception as e: logger.error(f"文件下载失败: {e}"); return jsonify({'error': f'文件下载失败: {str(e)}'}), 500

@app.route('/api/config', methods=['GET'])
def get_config():
    try:
        return jsonify({
            'character_mapping': config_manager.get_character_mapping(),
            'parsing_config': config_manager.get_parsing_config(),
            'quotes_config': config_manager.get_quotes_config()
        })
    except Exception as e:
        logger.error(f"获取配置失败: {e}", exc_info=True)
        return jsonify({'error': f'获取配置失败: {str(e)}'}), 500

@app.route('/api/config', methods=['POST'])
def update_config():
    try:
        data = request.get_json(); character_mapping = data.get('character_mapping', {})
        validated_mapping = {}
        for name, ids in character_mapping.items():
            if isinstance(ids, list) and all(isinstance(id_, int) for id_ in ids):
                validated_mapping[name] = ids
        config_manager.update_character_mapping(validated_mapping)
        # 重新初始化转换器以确保配置生效
        global converter
        converter = TextConverter(config_manager)
        return jsonify({'message': '配置更新成功'})
    except Exception as e: logger.error(f"配置更新失败: {e}"); return jsonify({'error': f'配置更新失败: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)