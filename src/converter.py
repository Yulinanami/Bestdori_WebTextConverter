# 文本转换器
import json
import logging
from dataclasses import asdict
from typing import Dict, List, Any
from .models import ConversionResult, ActionItem, LayoutActionItem

logger = logging.getLogger(__name__)

class QuoteHandler:
    def remove_quotes(self, text: str, active_quote_pairs: Dict[str, str]) -> str:
        stripped = text.strip()
        # 确保文本足够长以包含一对引号
        if len(stripped) < 2 or not active_quote_pairs:
            return text
        
        first_char = stripped[0]
        expected_closing = active_quote_pairs.get(first_char)
        
        if expected_closing and stripped.endswith(expected_closing):
            # 移除首尾字符并再次去除可能存在的空格
            return stripped[1:-1].strip()
        
        return text

class ProjectConverter:
    """
    一个专门用于将“统一项目文件”转换为Bestdori JSON的转换器。
    """
    def __init__(self):
        self.quote_handler = QuoteHandler()

    # --- 2. 修改 convert 方法签名 ---
    def convert(self, project_file: Dict[str, Any], quote_config: List[List[str]] = None) -> str:
        
        # 将传入的引号列表转换为更易于使用的字典
        active_quote_pairs = {pair[0]: pair[1] for pair in quote_config} if quote_config else {}

        # --- 3. 将 active_quote_pairs 传递下去 ---
        actions = self._translate_actions(project_file.get("actions", []), active_quote_pairs)
        global_settings = project_file.get("globalSettings", {})

        result = ConversionResult(
            server=global_settings.get("server", 0),
            voice=global_settings.get("voice", ""),
            background=global_settings.get("background"),
            bgm=global_settings.get("bgm"),
            actions=actions
        )

        return json.dumps(asdict(result), ensure_ascii=False, indent=2)

    def _translate_actions(self, project_actions: List[Dict[str, Any]], active_quote_pairs: Dict[str, str]) -> List[Dict[str, Any]]:
        translated_actions = []
        for action in project_actions:
            action_type = action.get("type")
            if action_type == "talk":
                # --- 4. 传递 active_quote_pairs ---
                translated_actions.append(self._translate_talk_action(action, active_quote_pairs))
            elif action_type == "layout":
                translated_actions.append(self._translate_layout_action(action))
        return translated_actions

    def _translate_talk_action(self, talk_action: Dict[str, Any], active_quote_pairs: Dict[str, str]) -> Dict[str, Any]:
        speakers = talk_action.get("speakers", [])
        character_ids = [s.get("characterId") for s in speakers if s.get("characterId") is not None]
        names = [s.get("name", "") for s in speakers]
        
        original_text = talk_action.get("text", "")
        # --- 5. 在这里执行引号处理 ---
        processed_body = self.quote_handler.remove_quotes(original_text, active_quote_pairs)

        motions = []
        character_states = talk_action.get("characterStates", {})
        for char_id_str, state in character_states.items():
            motions.append({
                "character": int(char_id_str),
                "motion": state.get("motion", ""),
                "expression": state.get("expression", ""),
                "delay": state.get("delay", 0)
            })

        bestdori_action = ActionItem(
            characters=character_ids,
            name=" & ".join(names),
            body=processed_body, # 使用处理过的文本
            motions=motions
        )
        return asdict(bestdori_action)

    def _translate_layout_action(self, layout_action: Dict[str, Any]) -> Dict[str, Any]:
        position = layout_action.get("position", {})
        initial_state = layout_action.get("initialState", {})

        bestdori_action = LayoutActionItem(
            layoutType=layout_action.get("layoutType", "appear"),
            character=layout_action.get("characterId", 0),
            costume=layout_action.get("costume", ""),
            motion=initial_state.get("motion", ""),
            expression=initial_state.get("expression", ""),
            sideFrom=position.get("from", "center"),
            sideTo=position.get("to", "center"),
            sideFromOffsetX=position.get("offsetX", 0),
            sideToOffsetX=position.get("offsetX", 0)
        )
        return asdict(bestdori_action)