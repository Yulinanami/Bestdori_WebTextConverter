# --- START OF FILE app.py (FINAL CORRECTED VERSION) ---

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
                "quote_pairs": {'"': '"', '“': '”', "'": "'", '‘': '’', "「": "」", "『": "』"},
                "quote_categories": {
                    "中文引号 “...”": ["“", "”"], "中文单引号 ‘...’": ["‘", "’"],
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

config_manager = ConfigManager()
converter = TextConverter(config_manager)

# --- (所有API路由代码无需修改，保持原样即可) ---
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

@app.route('/api/upload', methods=['POST'])
def upload_file():
    try:
        if 'file' not in request.files: return jsonify({'error': '没有文件被上传'}), 400
        file = request.files['file'];
        if file.filename == '': return jsonify({'error': '没有选择文件'}), 400
        if file and file.filename.lower().endswith('.txt'):
            return jsonify({'content': file.read().decode('utf-8')})
        else: return jsonify({'error': '只支持.txt文件'}), 400
    except Exception as e: logger.error(f"文件上传失败: {e}"); return jsonify({'error': f'文件上传失败: {str(e)}'}), 500

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
        validated_mapping = {};
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