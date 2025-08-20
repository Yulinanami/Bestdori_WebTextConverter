# 文本转换器
import json
import logging
from dataclasses import asdict
from typing import Dict, List, Any
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


class TextConverter:
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.character_mapping = config_manager.get_character_mapping()
        self.costume_mapping = config_manager.get_costume_mapping()
        self.parsing_config = config_manager.get_parsing_config()
        self.patterns = config_manager.get_patterns()
        self._init_parsers()
        self.mujica_output_mapping = (
            {  # 因为Mujica的角色图标还没有出来，所以暂时使用ppp的角色ID映射
                229: 6,  # 纯田真奈
                337: 1,  # 三角初华
                338: 2,  # 若叶睦
                339: 3,  # 八幡海铃
                340: 4,  # 祐天寺若麦
                341: 5,  # 丰川祥子
            }
        )

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
        active_quote_pairs = {
            pair[0]: pair[1]
            for pair in selected_quote_pairs_list
            if isinstance(pair, list) and len(pair) == 2
        }
        actions = []
        appeared_character_names = set()
        appearance_order = {}
        current_action_name = narrator_name
        current_action_body_lines = []
        effective_costume_mapping = {}
        if enable_live2d:
            effective_costume_mapping = self.costume_mapping.copy()
            if custom_costume_mapping:
                logger.info(f"自定义服装映射: {custom_costume_mapping}")
                effective_costume_mapping.update(custom_costume_mapping)
                logger.info(
                    f"合并后的服装映射（部分）: {dict(list(effective_costume_mapping.items())[:5])}"
                )
        auto_position_mode = True
        manual_positions = {}
        positions = ["leftInside", "center", "rightInside"]
        if position_config:
            auto_position_mode = position_config.get("autoPositionMode", True)
            manual_positions = position_config.get("manualPositions", {})
            logger.info(
                f"位置配置 - 自动模式: {auto_position_mode}, 手动配置: {manual_positions}"
            )

        # 获取角色位置的辅助函数
        def get_character_position_config(
            character_name: str,
            order: int,
        ) -> Dict[str, Any]:
            if auto_position_mode:
                return {"position": positions[order % len(positions)], "offset": 0}
            else:
                config = manual_positions.get(character_name, {})
                if isinstance(config, str):
                    return {"position": config, "offset": 0}
                else:
                    return {
                        "position": config.get("position", "center"),
                        "offset": config.get("offset", 0),
                    }

        def finalize_current_action():
            if current_action_body_lines:
                body = "\n".join(current_action_body_lines).strip()
                finalized_body = self.quote_handler.remove_quotes(
                    body, active_quote_pairs
                )
                if finalized_body:
                    character_ids = self.character_mapping.get(current_action_name, [])
                    if (
                        enable_live2d
                        and character_ids
                        and current_action_name != narrator_name
                    ):
                        primary_character_id = character_ids[0]
                        if current_action_name not in appeared_character_names:
                            appeared_character_names.add(current_action_name)
                            order = len(appearance_order)
                            appearance_order[current_action_name] = order
                            position_config = get_character_position_config(
                                current_action_name, order
                            )
                            position = position_config["position"]
                            offset = position_config["offset"]
                            costume_id = ""
                            if custom_costume_mapping:
                                costume_id = custom_costume_mapping.get(
                                    current_action_name, ""
                                )
                                logger.info(
                                    f"从自定义映射获取 {current_action_name} 的服装: {costume_id}"
                                )
                            if not costume_id and effective_costume_mapping:
                                costume_id = effective_costume_mapping.get(
                                    primary_character_id, ""
                                )
                                logger.info(
                                    f"从默认映射获取 ID {primary_character_id} 的服装: {costume_id}"
                                )
                            logger.info(
                                f"角色 {current_action_name} (ID: {primary_character_id}) 最终使用服装: {costume_id}"
                            )
                            logger.info(
                                f"角色 {current_action_name} 分配到位置: {position}，偏移: {offset}"
                            )
                            output_char_id = self.mujica_output_mapping.get(
                                primary_character_id, primary_character_id
                            )
                            layout_action = LayoutActionItem(
                                character=output_char_id,
                                costume=costume_id,
                                sideFrom=position,
                                sideTo=position,
                                sideFromOffsetX=offset,
                                sideToOffsetX=offset,
                            )
                            actions.append(layout_action)
                    output_character_ids = self._get_output_character_ids(character_ids)
                    talk_action = ActionItem(
                        characters=output_character_ids,
                        name=current_action_name,
                        body=finalized_body,
                    )
                    actions.append(talk_action)

        for line in input_text.split("\n"):
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
        all_actions = [asdict(action) for action in actions]
        result = ConversionResult(actions=all_actions)
        return json.dumps(asdict(result), ensure_ascii=False, indent=2)
