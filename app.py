# --- START OF FILE app.py (CORRECTED) ---

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

# 定义项目的绝对路径
project_root = os.path.dirname(os.path.abspath(__file__))

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

template_folder = os.path.join(project_root, 'templates')
# --- 唯一的修改：明确指定 static 文件夹以支持分离的 CSS/JS ---
static_folder = os.path.join(project_root, 'static')
app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)

app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = '/tmp' 

@dataclass
class ActionItem:
    """对话动作数据类"""
    type: str = "talk"
    delay: int = 0
    wait: bool = True
    characters: List[int] = None
    name: str = ""
    body: str = ""
    motions: List[str] = None
    voices: List[str] = None
    close: bool = False
    
    def __post_init__(self):
        if self.characters is None:
            self.characters = []
        if self.motions is None:
            self.motions = []
        if self.voices is None:
            self.voices = []

@dataclass
class ConversionResult:
    """转换结果数据类"""
    server: int = 0
    voice: str = ""
    background: Optional[str] = None
    bgm: Optional[str] = None
    actions: List[ActionItem] = None
    
    def __post_init__(self):
        if self.actions is None:
            self.actions = []

class ConfigManager:
    def __init__(self, config_path: str = "config.yaml"):
        if not os.path.isabs(config_path):
            config_path = os.path.join(project_root, config_path)
        self.config_path = Path(config_path)
        self.config = self._load_config()
        logger.info(f"ConfigManager using config file: {self.config_path}")

    def _load_config(self) -> Dict[str, Any]:
        default_config = {
            "character_mapping": {
                # MyGo
                "高松灯": [36], "千早爱音": [37], "要乐奈": [38], "长崎素世": [39], "椎名立希": [40]
            },
            "parsing": {
                "max_speaker_name_length": 50, 
                "default_narrator_name": " "
            },
            "patterns": {
                "speaker_pattern": r'^([\w\s]+)\s*[：:]\s*(.*)$'
            },
            "quotes": {
                "quote_pairs": {
                    '"': '"', '“': '”', "'": "'", '‘': '’', "「": "」", "『": "』"
                },
                "quote_categories": {
                    "中文引号 “...”": ["“", "”"],
                    "中文单引号 ‘...’": ["‘", "’"],
                    "日文引号 「...」": ["「", "」"],
                    "日文书名号 『...』": ["『", "』"],
                    "英文双引号 \"...\"": ['"', '"'],
                    "英文单引号 '...'": ["'", "'"]
                }
            }
        }
        if not self.config_path.exists():
            self._save_config(default_config)
            return default_config
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                loaded_config = yaml.safe_load(f) or default_config
                # 检查并更新旧配置
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

class DialogueParser(ABC):
    @abstractmethod
    def parse(self, line: str) -> Optional[Tuple[str, str]]: pass

class SpeakerParser(DialogueParser):
    def __init__(self, pattern: str, max_name_length: int):
        self.pattern = re.compile(pattern, re.UNICODE); self.max_name_length = max_name_length
    def parse(self, line: str) -> Optional[Tuple[str, str]]:
        match = self.pattern.match(line.strip())
        if match and len(match.group(1).strip()) < self.max_name_length:
            return match.group(1).strip(), match.group(2).strip()
        
class QuoteHandler:
    def remove_quotes(self, text: str, active_quote_pairs: Dict[str, str]) -> str:
        stripped = text.strip()
        if len(stripped) < 2: return text
        first_char = stripped[0]
        expected_closing = active_quote_pairs.get(first_char)
        if expected_closing and stripped[-1] == expected_closing:
            return stripped[1:-1].strip()
        return text

class QuotedDialogueParser(DialogueParser):
    """带引号对话解析器"""
    
    def __init__(self, pattern: str, max_name_length: int):
        self.pattern = re.compile(pattern, re.UNICODE)
        self.max_name_length = max_name_length
    
    def can_parse(self, line: str) -> bool:
        match = self.pattern.match(line.strip())
        return match and len(match.group(1).strip()) < self.max_name_length
    
    def parse(self, line: str) -> Tuple[str, str]:
        match = self.pattern.match(line.strip())
        if match:
            return match.group(1).strip(), match.group(2).strip()
        return "", ""

class NoQuotesDialogueParser(DialogueParser):
    """无引号对话解析器"""
    
    def __init__(self, pattern: str, max_name_length: int):
        self.pattern = re.compile(pattern, re.UNICODE)
        self.max_name_length = max_name_length
    
    def can_parse(self, line: str) -> bool:
        match = self.pattern.match(line.strip())
        return match and len(match.group(1).strip()) < self.max_name_length
    
    def parse(self, line: str) -> Tuple[str, str]:
        match = self.pattern.match(line.strip())
        if match:
            return match.group(1).strip(), match.group(2).strip()
        return "", ""

class NarratorParser(DialogueParser):
    """旁白解析器"""
    
    def __init__(self, narrator_name: str):
        self.narrator_name = narrator_name
    
    def can_parse(self, line: str) -> bool:
        stripped = line.strip()
        return stripped.startswith(('"', '“')) and stripped.endswith(('"', '”'))
    
    def parse(self, line: str) -> Tuple[str, str]:
        stripped = line.strip()
        return self.narrator_name, stripped[1:-1].strip()

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

    def convert_text_to_json_format(self, input_text: str, narrator_name: str, selected_quote_categories: List[str]) -> str:
        all_quote_categories = self.config_manager.get_quotes_config().get("quote_categories", {})
        active_quote_pairs = {
            chars[0]: chars[1]
            for category, chars in all_quote_categories.items()
            if category in selected_quote_categories and len(chars) == 2
        }
        
        actions = []
        current_action_name = narrator_name
        current_action_body_lines = []

        def finalize_current_action():
            if current_action_body_lines:
                body = "\n".join(current_action_body_lines).strip()
                # 在最后合并时才移除引号
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
            else: # 如果不是“角色:内容”格式，则认为是当前说话人的延续或旁白
                current_action_body_lines.append(stripped_line)

        finalize_current_action()
        result = ConversionResult(actions=actions)
        return json.dumps(asdict(result), ensure_ascii=False, indent=2)

# 全局变量
config_manager = ConfigManager()
converter = TextConverter(config_manager)

@app.route('/')
def index():
    """主页"""
    return render_template('index.html')

@app.route('/api/convert', methods=['POST'])
def convert_text():
    try:
        data = request.get_json()
        input_text = data.get('text', '')
        narrator_name = data.get('narrator_name', ' ')
        # 接收前端传来的引号种类列表
        selected_quotes = data.get('selected_quotes', [])
        
        if not input_text.strip():
            return jsonify({'error': '输入文本不能为空'}), 400
        
        result = converter.convert_text_to_json_format(input_text, narrator_name, selected_quotes)
        return jsonify({'result': result})
    except Exception as e:
        logger.error(f"转换失败: {e}", exc_info=True)
        return jsonify({'error': f'转换失败: {str(e)}'}), 500

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """文件上传接口"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': '没有文件被上传'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': '没有选择文件'}), 400
        
        if file and file.filename.lower().endswith('.txt'):
            content = file.read().decode('utf-8')
            return jsonify({'content': content})
        else:
            return jsonify({'error': '只支持.txt文件'}), 400
            
    except Exception as e:
        logger.error(f"文件上传失败: {e}")
        return jsonify({'error': f'文件上传失败: {str(e)}'}), 500

@app.route('/api/download', methods=['POST'])
def download_result():
    """下载结果文件"""
    try:
        data = request.get_json()
        content = data.get('content', '')
        filename = data.get('filename', 'result.json')
        
        temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8')
        temp_file.write(content)
        temp_file.close()
        
        return send_file(
            temp_file.name,
            as_attachment=True,
            download_name=secure_filename(filename),
            mimetype='application/json'
        )
        
    except Exception as e:
        logger.error(f"文件下载失败: {e}")
        return jsonify({'error': f'文件下载失败: {str(e)}'}), 500

@app.route('/api/config', methods=['GET'])
def get_config():
    try:
        return jsonify({
            'character_mapping': config_manager.get_character_mapping(),
            'parsing_config': config_manager.get_parsing_config(),
            # 新增：将引号配置也发送给前端
            'quotes_config': config_manager.get_quotes_config()
        })
    except Exception as e:
        logger.error(f"获取配置失败: {e}", exc_info=True)
        return jsonify({'error': f'获取配置失败: {str(e)}'}), 500

@app.route('/api/config', methods=['POST'])
def update_config():
    """更新配置"""
    try:
        data = request.get_json(); character_mapping = data.get('character_mapping', {})
        validated_mapping = {};
        for name, ids in character_mapping.items():
            if isinstance(ids, list) and all(isinstance(id_, int) for id_ in ids):
                validated_mapping[name] = ids
        config_manager.update_character_mapping(validated_mapping)
        converter.character_mapping = validated_mapping # 更新转换器实例
        return jsonify({'message': '配置更新成功'})
    except Exception as e: logger.error(f"配置更新失败: {e}"); return jsonify({'error': f'配置更新失败: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)