# 文本转换器
import json
import logging
from dataclasses import asdict
from typing import Dict, List, Any
from .models import ConversionResult, ActionItem, LayoutActionItem

logger = logging.getLogger(__name__)

class ProjectConverter:
    """
    一个专门用于将“统一项目文件”转换为Bestdori JSON的转换器。
    """
    def convert(self, project_file: Dict[str, Any]) -> str:
        actions = self._translate_actions(project_file.get("actions", []))
        global_settings = project_file.get("globalSettings", {})

        result = ConversionResult(
            server=global_settings.get("server", 0),
            voice=global_settings.get("voice", ""),
            background=global_settings.get("background"),
            bgm=global_settings.get("bgm"),
            actions=actions
        )

        return json.dumps(asdict(result), ensure_ascii=False, indent=2)

    def _translate_actions(self, project_actions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        translated_actions = []
        for action in project_actions:
            action_type = action.get("type")
            if action_type == "talk":
                translated_actions.append(self._translate_talk_action(action))
            elif action_type == "layout":
                translated_actions.append(self._translate_layout_action(action))
        return translated_actions

    def _translate_talk_action(self, talk_action: Dict[str, Any]) -> Dict[str, Any]:
        speakers = talk_action.get("speakers", [])
        character_ids = [s.get("characterId") for s in speakers if s.get("characterId") is not None]
        names = [s.get("name", "") for s in speakers]

        # 从 characterStates 对象构建 motions 数组
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
            body=talk_action.get("text", ""),
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