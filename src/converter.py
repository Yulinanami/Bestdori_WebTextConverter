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
        append_spaces: int = 0,
    ) -> str:

        active_quote_pairs = (
            {pair[0]: pair[1] for pair in quote_config} if quote_config else {}
        )
        actions = self._translate_actions(
            project_file.get("actions", []),
            active_quote_pairs,
            narrator_name,
            append_spaces,
        )
        global_settings = project_file.get("globalSettings", {})

        # 统计转换信息
        talk_actions = [a for a in actions if a.get("characters") is not None]
        layout_actions = [a for a in actions if a.get("layoutType") is not None]
        unique_characters = set()
        for action in actions:
            if "characters" in action:
                unique_characters.update(action.get("characters", []))
            if "character" in action:
                unique_characters.add(action["character"])

        logger.info(
            f"转换统计 - 对话动作: {len(talk_actions)}, 布局动作: {len(layout_actions)}, 涉及角色数: {len(unique_characters)}"
        )
        logger.info(
            f"全局设置 - 服务器: {global_settings.get('server', 0)}, 背景: {global_settings.get('background', 'N/A')}, BGM: {global_settings.get('bgm', 'N/A')}"
        )

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
        append_spaces: int,
    ) -> List[Dict[str, Any]]:
        translated_actions = []
        for action in project_actions:
            action_type = action.get("type")
            if action_type == "talk":
                translated_actions.append(
                    self._translate_talk_action(
                        action,
                        active_quote_pairs,
                        narrator_name,
                        append_spaces,  # 传递新参数
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
        append_spaces: int,
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

        if append_spaces > 0:
            processed_body += " " * append_spaces

        # 处理动作/表情配置（motions数组格式）
        motions = []

        if "motions" in talk_action and talk_action["motions"]:
            for motion_data in talk_action["motions"]:
                char_id = int(motion_data.get("character", 0))
                motion = motion_data.get("motion", "")
                expression = motion_data.get("expression", "")
                delay = motion_data.get("delay", 0)

                if motion or expression:  # 只添加有实际内容的动作
                    motions.append(
                        {
                            "character": self._get_output_id(char_id),
                            "motion": motion,
                            "expression": expression,
                            "delay": delay,
                        }
                    )
                    # 记录动作详情
                    logger.info(
                        f"  角色 {char_id} - 动作: {motion or '无'}, 表情: {expression or '无'}, 延迟: {delay}秒"
                    )

        if speakers:
            action_name = " & ".join(names)
            logger.info(
                f"对话动作 - 说话人: {action_name} (ID: {character_ids}), 内容: {processed_body[:30]}..."
            )
        else:
            action_name = narrator_name
            logger.info(f"对话动作 - 旁白: {processed_body[:30]}...")

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
        layout_type = layout_action.get("layoutType", "appear")
        costume = layout_action.get("costume", "")
        motion = initial_state.get("motion", "")
        expression = initial_state.get("expression", "")
        delay = layout_action.get("delay", 0)
        from_pos = position.get("from", {})
        to_pos = position.get("to", {})
        side_from = from_pos.get("side", "center")
        side_to = to_pos.get("side", "center")
        offset_from = from_pos.get("offsetX", 0)
        offset_to = to_pos.get("offsetX", 0)

        # 记录布局动作详情
        logger.info(
            f"布局动作 - 类型: {layout_type}, 角色ID: {char_id}, 服装: {costume or '默认'}, 延迟: {delay}秒"
        )
        logger.info(
            f"  位置: {side_from}({offset_from:+d}) -> {side_to}({offset_to:+d})"
        )
        logger.info(f"  初始状态 - 动作: {motion or '无'}, 表情: {expression or '无'}")

        bestdori_action = LayoutActionItem(
            layoutType=layout_type,
            character=self._get_output_id(char_id),
            costume=costume,
            motion=motion,
            expression=expression,
            delay=delay,
            sideFrom=side_from,
            sideFromOffsetX=offset_from,
            sideTo=side_to,
            sideToOffsetX=offset_to,
        )

        return asdict(bestdori_action)
