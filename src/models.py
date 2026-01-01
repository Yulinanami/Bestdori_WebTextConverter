# 数据模型（用 dataclass 表示输出 JSON 的结构）
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class ActionItem:
    # 一条“对话动作”（talk）
    type: str = "talk"
    delay: int = 0
    wait: bool = True
    characters: List[int] = field(default_factory=list)
    name: str = ""
    body: str = ""
    motions: List[str] = field(default_factory=list)
    voices: List[str] = field(default_factory=list)
    close: bool = False


@dataclass
class LayoutActionItem:
    # 一条“布局动作”（layout：出场/移动/退场等）
    type: str = "layout"
    delay: int = 0
    wait: bool = True
    layoutType: str = "appear"
    character: int = 0
    costume: str = ""
    motion: str = ""
    expression: str = ""
    sideFrom: str = "center"
    sideFromOffsetX: int = 0
    sideTo: str = "center"
    sideToOffsetX: int = 0


@dataclass
class ConversionResult:
    # 最终输出的整体结果（包含全局设置 + 动作列表）
    server: int = 0
    voice: str = ""
    background: Optional[str] = None
    bgm: Optional[str] = None
    actions: List[Dict[str, Any]] = field(default_factory=list)
