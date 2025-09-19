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
        if len(stripped) < 2 or not active_quote_pairs:
            return text
        first_char = stripped[0]
        expected_closing = active_quote_pairs.get(first_char)
        if expected_closing and stripped.endswith(expected_closing):
            return stripped[1:-1].strip()

        return text


class ProjectConverter:
    def __init__(self):
        self.quote_handler = QuoteHandler()
        self.special_id_mapping = {
            229: 6,  # 纯田真奈
            337: 1,  # 三角初华
            338: 2,  # 若叶睦
            339: 3,  # 八幡海铃
            340: 4,  # 祐天寺若麦
            341: 5,  # 丰川祥子
        }

    def _get_output_id(self, char_id: int) -> int:
        return self.special_id_mapping.get(char_id, char_id)

    def _get_output_ids(self, char_ids: List[int]) -> List[int]:
        return [self._get_output_id(cid) for cid in char_ids]

    def convert(
        self,
        project_file: Dict[str, Any],
        quote_config: List[List[str]] = None,
        narrator_name: str = " ",
    ) -> str:

        active_quote_pairs = (
            {pair[0]: pair[1] for pair in quote_config} if quote_config else {}
        )
        actions = self._translate_actions(
            project_file.get("actions", []), active_quote_pairs, narrator_name
        )
        global_settings = project_file.get("globalSettings", {})

        result = ConversionResult(
            server=global_settings.get("server", 0),
            voice=global_settings.get("voice", ""),
            background=global_settings.get("background"),
            bgm=global_settings.get("bgm"),
            actions=actions,
        )

        return json.dumps(asdict(result), ensure_ascii=False, indent=2)

    def _translate_actions(
        self,
        project_actions: List[Dict[str, Any]],
        active_quote_pairs: Dict[str, str],
        narrator_name: str,
    ) -> List[Dict[str, Any]]:
        translated_actions = []
        for action in project_actions:
            action_type = action.get("type")
            if action_type == "talk":
                translated_actions.append(
                    self._translate_talk_action(
                        action, active_quote_pairs, narrator_name
                    )
                )
            elif action_type == "layout":
                translated_actions.append(self._translate_layout_action(action))
        return translated_actions

    def _translate_talk_action(
        self,
        talk_action: Dict[str, Any],
        active_quote_pairs: Dict[str, str],
        narrator_name: str,
    ) -> Dict[str, Any]:
        speakers = talk_action.get("speakers", [])
        character_ids = [
            int(s.get("characterId"))
            for s in speakers
            if s.get("characterId") is not None
        ]
        names = [s.get("name", "") for s in speakers]
        original_text = talk_action.get("text", "")
        processed_body = self.quote_handler.remove_quotes(
            original_text, active_quote_pairs
        )
        motions = []
        character_states = talk_action.get("characterStates", {})
        for char_id_str, state in character_states.items():
            motions.append(
                {
                    "character": self._get_output_id(int(char_id_str)),
                    "motion": state.get("motion", ""),
                    "expression": state.get("expression", ""),
                    "delay": state.get("delay", 0),
                }
            )
        if speakers:
            action_name = " & ".join(names)
        else:
            action_name = narrator_name
        bestdori_action = ActionItem(
            characters=self._get_output_ids(character_ids),
            name=action_name,
            body=processed_body,
            motions=motions,
        )
        return asdict(bestdori_action)

    def _translate_layout_action(self, layout_action: Dict[str, Any]) -> Dict[str, Any]:
        position = layout_action.get("position", {})
        initial_state = layout_action.get("initialState", {})
        char_id = int(layout_action.get("characterId", 0))
        from_pos = position.get("from", {})
        to_pos = position.get("to", {})
        bestdori_action = LayoutActionItem(
            layoutType=layout_action.get("layoutType", "appear"),
            character=self._get_output_id(char_id),
            costume=layout_action.get("costume", ""),
            motion=initial_state.get("motion", ""),
            expression=initial_state.get("expression", ""),
            sideFrom=from_pos.get("side", "center"),
            sideFromOffsetX=from_pos.get("offsetX", 0),
            sideTo=to_pos.get("side", "center"),
            sideToOffsetX=to_pos.get("offsetX", 0),
        )

        return asdict(bestdori_action)
