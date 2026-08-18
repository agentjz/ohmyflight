"""Workbench payload and existing lock-entry input adapters."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .common import parse_whitelist
from .input_data import parse_batch_input as parse_original_batch
from .input_data import parse_excel_file as parse_original_excel
from .smart_input import parse_excel_file as parse_smart_excel
from .smart_runner import parse_batch_input as parse_smart_batch


WorkbenchMode = Literal["original", "smart"]


@dataclass(frozen=True)
class RunConfig:
    run_id: str
    mode: WorkbenchMode
    input_mode: str
    output_directory: str
    input_path: str = ""
    pasted_text: str = ""
    whitelist_text: str = ""
    common_reason: str = ""
    conflict_recovery: bool = False
    browser_path: str = ""
    auto_run: bool = False


def normalize_mode(value: str) -> WorkbenchMode:
    if value not in {"original", "smart"}:
        raise ValueError(f"不支持的锁班模式：{value}")
    return value  # type: ignore[return-value]


def read_input(config: RunConfig) -> tuple[list[dict], list[str]]:
    whitelist = parse_whitelist(config.whitelist_text) or None
    if config.input_mode == "excel":
        if not config.input_path:
            raise ValueError("没有收到 Excel 文件")
        parser = parse_smart_excel if config.mode == "smart" else parse_original_excel
        return parser(config.input_path, whitelist)
    if config.input_mode == "paste":
        parser = parse_smart_batch if config.mode == "smart" else parse_original_batch
        return parser(config.pasted_text, whitelist)
    raise ValueError(f"不支持的输入方式：{config.input_mode}")
