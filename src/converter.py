# 文本转换器
import json
import logging
from dataclasses import asdict
from typing import Dict, List, Any, Set
from .models import ActionItem, LayoutActionItem, ConversionResult
from .config import ConfigManager
from .parser import SpeakerParser

logger = logging.getLogger(__name__)


class QuoteHandler:
    def remove_quotes(self, text: str, active_quote_pairs: Dict[str, str]) -> str:
        stripped = text.strip()
        if len(stripped) < 2:
            return text
        first_char = stripped[0]
        expected_closing = active_quote_pairs.get(first_char)
        if expected_closing and stripped[-1] == expected_closing:
            return stripped[1:-1].strip()
        return text


class ConversionProcessor:
    def __init__(self, converter_instance: "TextConverter", config: Dict[str, Any]):
        self.converter = converter_instance
        self.narrator_name = config.get("narrator_name")
        self.active_quote_pairs = config.get("active_quote_pairs", {})
        self.enable_live2d = config.get("enable_live2d", False)
        self.effective_costume_mapping = config.get("effective_costume_mapping", {})
        self.auto_position_mode = config.get("auto_position_mode", True)
        self.manual_positions = config.get("manual_positions", {})
        self.positions = ["leftInside", "center", "rightInside"]

        self.actions: List[Any] = []
        self.appeared_character_names: Set[str] = set()
        self.appearance_order: Dict[str, int] = {}
        self.current_action_name: str = self.narrator_name
        self.current_action_body_lines: List[str] = []

    def _get_character_position_config(
        self, character_name: str, order: int
    ) -> Dict[str, Any]:
        if self.auto_position_mode:
            return {
                "position": self.positions[order % len(self.positions)],
                "offset": 0,
            }
        else:
            config = self.manual_positions.get(character_name, {})
            return {
                "position": config.get("position", "center"),
                "offset": config.get("offset", 0),
            }

    def _add_layout_action_if_needed(
        self, character_name: str, character_ids: List[int]
    ) -> None:
        if not (
            self.enable_live2d
            and character_ids
            and character_name != self.narrator_name
        ):
            return

        if character_name not in self.appeared_character_names:
            self.appeared_character_names.add(character_name)
            order = len(self.appearance_order)
            self.appearance_order[character_name] = order
            primary_character_id = character_ids[0]
            position_config = self._get_character_position_config(character_name, order)
            position = position_config["position"]
            offset = position_config["offset"]
            costume_id = self.effective_costume_mapping.get(character_name, "")

            logger.info(
                f"角色 {character_name} (ID: {primary_character_id}) 最终使用服装: {costume_id}"
            )
            logger.info(f"角色 {character_name} 分配到位置: {position}，偏移: {offset}")

            output_char_id = self.converter._get_output_character_ids(
                [primary_character_id]
            )[0]
            layout_action = LayoutActionItem(
                character=output_char_id,
                costume=costume_id,
                sideFrom=position,
                sideTo=position,
                sideFromOffsetX=offset,
                sideToOffsetX=offset,
            )
            self.actions.append(layout_action)

    def _finalize_action(self) -> None:
        if not self.current_action_body_lines:
            return
        body = "\n".join(self.current_action_body_lines).strip()
        finalized_body = self.converter.quote_handler.remove_quotes(
            body, self.active_quote_pairs
        )
        if finalized_body:
            character_ids = self.converter.character_mapping.get(
                self.current_action_name, []
            )
            self._add_layout_action_if_needed(self.current_action_name, character_ids)

            output_character_ids = self.converter._get_output_character_ids(
                character_ids
            )
            talk_action = ActionItem(
                characters=output_character_ids,
                name=self.current_action_name,
                body=finalized_body,
            )
            self.actions.append(talk_action)

    def process_line(self, line: str) -> None:
        stripped_line = line.strip()
        if not stripped_line:
            self._finalize_action()
            self.current_action_name = self.narrator_name
            self.current_action_body_lines = []
            return
        parse_result = self.converter.parser.parse(stripped_line)
        if parse_result:
            speaker, content = parse_result
            if speaker != self.current_action_name and self.current_action_body_lines:
                self._finalize_action()
                self.current_action_body_lines = []
            self.current_action_name = speaker
            self.current_action_body_lines.append(content)
        else:
            if self.current_action_name == self.narrator_name:
                self.current_action_body_lines.append(stripped_line)
            else:
                self.current_action_body_lines.append(stripped_line)

    def run(self, input_text: str) -> List[Any]:
        for line in input_text.split("\n"):
            self.process_line(line)
        self._finalize_action()
        return self.actions


class TextConverter:
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.character_mapping = config_manager.get_character_mapping()
        self.costume_mapping = config_manager.get_costume_mapping()
        self.parsing_config = config_manager.get_parsing_config()
        self.patterns = config_manager.get_patterns()
        self._init_parsers()
        self.mujica_output_mapping = {
            229: 6,  # 纯田真奈
            337: 1,  # 三角初华
            338: 2,  # 若叶睦
            339: 3,  # 八幡海铃
            340: 4,  # 祐天寺若麦
            341: 5,  # 丰川祥子
        }

    def _init_parsers(self):
        self.parser = SpeakerParser(
            self.patterns.get("speaker_pattern", r"^([\w\s]+)\s*[：:]\s*(.*)$"),
            self.parsing_config.get("max_speaker_name_length", 50),
        )
        self.quote_handler = QuoteHandler()

    def _get_output_character_ids(self, character_ids: List[int]) -> List[int]:
        output_ids = []
        for char_id in character_ids:
            if char_id in self.mujica_output_mapping:
                output_ids.append(self.mujica_output_mapping[char_id])
            else:
                output_ids.append(char_id)
        return output_ids

    def convert_text_to_json_format(
        self,
        input_text: str,
        narrator_name: str,
        selected_quote_pairs_list: List[List[str]],
        enable_live2d: bool = False,
        custom_costume_mapping: Dict[str, str] = None,
        position_config: Dict[str, Any] = None,
    ) -> str:
        effective_costume_mapping = {}
        if enable_live2d:
            for name, ids in self.character_mapping.items():
                primary_id = ids[0]
                if primary_id in self.costume_mapping:
                    effective_costume_mapping[name] = self.costume_mapping[primary_id]
            if custom_costume_mapping:
                effective_costume_mapping.update(custom_costume_mapping)
        processor_config = {
            "narrator_name": narrator_name,
            "active_quote_pairs": {
                pair[0]: pair[1]
                for pair in selected_quote_pairs_list
                if isinstance(pair, list) and len(pair) == 2
            },
            "enable_live2d": enable_live2d,
            "effective_costume_mapping": effective_costume_mapping,
            "auto_position_mode": (
                position_config.get("autoPositionMode", True)
                if position_config
                else True
            ),
            "manual_positions": (
                position_config.get("manualPositions", {}) if position_config else {}
            ),
        }
        processor = ConversionProcessor(self, processor_config)
        actions_list = processor.run(input_text)
        all_actions = [asdict(action) for action in actions_list]
        result = ConversionResult(actions=all_actions)
        return json.dumps(asdict(result), ensure_ascii=False, indent=2)
