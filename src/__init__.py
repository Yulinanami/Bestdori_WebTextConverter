# 日志基础配置（让各模块的 logger 输出到标准输出）
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(name)s - %(message)s",
    stream=sys.stdout,
)
