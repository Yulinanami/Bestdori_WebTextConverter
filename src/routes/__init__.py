# 汇总所有蓝图
from .conversion import conversion_bp
from .config import config_bp
from .merger import merger_bp

all_blueprints = [conversion_bp, config_bp, merger_bp]
