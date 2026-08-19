from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class QueryRecord:
    input_row: int
    employee_id: str
    name: str
    source: str


@dataclass(frozen=True)
class InputIssue:
    input_row: int
    employee_id: str
    name: str
    message: str
    source: str

    def __str__(self) -> str:
        return f"{self.source}：{self.message}"


@dataclass(frozen=True)
class QueryResult:
    page_name: str
    technical_rows: list[dict[str, str]]
    operation_rows: list[dict[str, str]]


@dataclass(frozen=True)
class RunSummary:
    total: int
    success: int
    failed: int
    interrupted: bool = False


@dataclass(frozen=True)
class RunConfig:
    run_id: str
    credentials: str
    input_mode: str
    output_directory: str
    input_path: str = ""
    pasted_text: str = ""
    auto_run: bool = False


@dataclass(frozen=True)
class OutputPaths:
    excel: Path
    report: Path


Event = dict[str, Any]

