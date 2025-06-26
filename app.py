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

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
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
    """配置管理器"""
    
    def __init__(self, config_path: str = "config.yaml"):
        self.config_path = Path(config_path)
        self.config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """加载配置文件"""
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
            "parsing": {
                "max_speaker_name_length": 50,
                "max_short_speaker_name_length": 6,
                "default_narrator_name": " "
            },
            "patterns": {
                "speaker_quoted": r'^([\w\s]+)\s*[：:]\s*[""](.*?)[""]$',
                "speaker_no_quotes": r'^([\w\s]+)\s*[：:]\s*(.*?)$'
            }
        }
        
        if not self.config_path.exists():
            self._save_config(default_config)
            return default_config
        
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or default_config
        except Exception as e:
            logger.warning(f"配置文件加载失败，使用默认配置: {e}")
            return default_config
    
    def _save_config(self, config: Dict[str, Any]):
        """保存配置文件"""
        try:
            with open(self.config_path, 'w', encoding='utf-8') as f:
                yaml.dump(config, f, default_flow_style=False, allow_unicode=True)
        except Exception as e:
            logger.error(f"配置文件保存失败: {e}")
    
    def get_character_mapping(self) -> Dict[str, List[int]]:
        return self.config.get("character_mapping", {})
    
    def get_parsing_config(self) -> Dict[str, Any]:
        return self.config.get("parsing", {})
    
    def get_patterns(self) -> Dict[str, str]:
        return self.config.get("patterns", {})
    
    def update_character_mapping(self, new_mapping: Dict[str, List[int]]):
        """更新角色映射"""
        self.config["character_mapping"] = new_mapping
        self._save_config(self.config)

class DialogueParser(ABC):
    """对话解析器抽象基类"""
    
    @abstractmethod
    def can_parse(self, line: str) -> bool:
        """判断是否能解析该行"""
        pass
    
    @abstractmethod
    def parse(self, line: str) -> Tuple[str, str]:
        """解析行，返回(说话人, 内容)"""
        pass

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
        return stripped.startswith(('"', '"')) and stripped.endswith(('"', '"'))
    
    def parse(self, line: str) -> Tuple[str, str]:
        stripped = line.strip()
        return self.narrator_name, stripped[1:-1].strip()

class TextConverter:
    """文本转换器主类"""
    
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.character_mapping = config_manager.get_character_mapping()
        self.parsing_config = config_manager.get_parsing_config()
        self.patterns = config_manager.get_patterns()
        
        self._init_parsers()
    
    def _init_parsers(self):
        """初始化解析器"""
        self.parsers = [
            QuotedDialogueParser(
                self.patterns.get("speaker_quoted", ""),
                self.parsing_config.get("max_speaker_name_length", 50)
            ),
            NoQuotesDialogueParser(
                self.patterns.get("speaker_no_quotes", ""),
                self.parsing_config.get("max_short_speaker_name_length", 6)
            )
        ]
    
    def convert_text_to_json_format(self, input_text: str, narrator_name: str = None) -> str:
        """将文本转换为JSON格式"""
        if narrator_name is None:
            narrator_name = self.parsing_config.get("default_narrator_name", " ")
        
        narrator_parser = NarratorParser(narrator_name)
        actions = []
        current_action_name = narrator_name
        current_action_body_lines = []
        
        def finalize_current_action():
            """完成当前动作块"""
            if current_action_body_lines:
                finalized_body = "\n".join(current_action_body_lines).strip()
                if finalized_body:
                    character_ids = self.character_mapping.get(current_action_name, [])
                    action_item = ActionItem(
                        characters=character_ids,
                        name=current_action_name,
                        body=finalized_body
                    )
                    actions.append(action_item)
        
        for line in input_text.split('\n'):
            stripped_line = line.strip()
            
            # 空行处理
            if not stripped_line:
                finalize_current_action()
                current_action_name = narrator_name
                current_action_body_lines = []
                continue
            
            # 尝试解析对话
            parsed = False
            for parser in self.parsers + [narrator_parser]:
                if parser.can_parse(stripped_line):
                    speaker, content = parser.parse(stripped_line)
                    
                    # 如果是新的说话人，完成当前动作块
                    if speaker != current_action_name and current_action_body_lines:
                        finalize_current_action()
                        current_action_body_lines = []
                    
                    current_action_name = speaker
                    if content:
                        current_action_body_lines.append(content)
                    parsed = True
                    break
            
            # 如果没有匹配的解析器，作为普通文本处理
            if not parsed:
                if not current_action_body_lines:
                    current_action_name = narrator_name
                current_action_body_lines.append(line.rstrip())
        
        # 处理最后一个动作块
        finalize_current_action()
        
        # 创建结果对象
        result = ConversionResult(actions=actions)
        
        # 转换为字典并序列化为JSON
        result_dict = asdict(result)
        return json.dumps(result_dict, ensure_ascii=False, indent=2)

# 全局变量
config_manager = ConfigManager()
converter = TextConverter(config_manager)

@app.route('/')
def index():
    """主页"""
    return render_template('index.html')

@app.route('/api/convert', methods=['POST'])
def convert_text():
    """转换文本接口"""
    try:
        data = request.get_json()
        input_text = data.get('text', '')
        narrator_name = data.get('narrator_name', ' ')
        
        if not input_text.strip():
            return jsonify({'error': '输入文本不能为空'}), 400
        
        # 执行转换
        result = converter.convert_text_to_json_format(input_text, narrator_name)
        
        return jsonify({'result': result})
        
    except Exception as e:
        logger.error(f"转换失败: {e}")
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
            # 读取文件内容
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
        
        # 创建临时文件
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
    """获取配置"""
    try:
        return jsonify({
            'character_mapping': config_manager.get_character_mapping(),
            'parsing_config': config_manager.get_parsing_config()
        })
    except Exception as e:
        logger.error(f"获取配置失败: {e}")
        return jsonify({'error': f'获取配置失败: {str(e)}'}), 500

@app.route('/api/config', methods=['POST'])
def update_config():
    """更新配置"""
    try:
        data = request.get_json()
        character_mapping = data.get('character_mapping', {})
        
        # 验证配置格式
        validated_mapping = {}
        for name, ids in character_mapping.items():
            if isinstance(ids, list) and all(isinstance(id_, int) for id_ in ids):
                validated_mapping[name] = ids
        
        # 更新配置
        config_manager.update_character_mapping(validated_mapping)
        converter.character_mapping = validated_mapping
        
        return jsonify({'message': '配置更新成功'})
        
    except Exception as e:
        logger.error(f"配置更新失败: {e}")
        return jsonify({'error': f'配置更新失败: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)