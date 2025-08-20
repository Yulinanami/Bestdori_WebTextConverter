from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class ActionItem:
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
    server: int = 0
    voice: str = ""
    background: Optional[str] = None
    bgm: Optional[str] = None
    actions: List[Dict[str, Any]] = field(default_factory=list)
