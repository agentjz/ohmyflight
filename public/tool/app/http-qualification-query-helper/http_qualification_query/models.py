from __future__ import annotations

from dataclasses import dataclass, field
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
    basic_info: dict[str, str] = field(default_factory=dict)
    education_rows: list[dict[str, str]] = field(default_factory=list)
    work_rows: list[dict[str, str]] = field(default_factory=list)
    title_rows: list[dict[str, str]] = field(default_factory=list)
    family_rows: list[dict[str, str]] = field(default_factory=list)
    training_record_rows: list[dict[str, str]] = field(default_factory=list)
    training_experience_rows: list[dict[str, str]] = field(default_factory=list)

    @property
    def basic_count(self) -> int:
        return int(bool(self.basic_info)) + len(self.education_rows) + len(self.work_rows) + len(self.title_rows) + len(self.family_rows)


@dataclass(frozen=True)
class RunSummary:
    total: int
    success: int
    failed: int
    interrupted: bool = False
    session_expired: bool = False


@dataclass(frozen=True)
class InputPayload:
    input_mode: str
    excel_name: str = ""
    excel_bytes: bytes | None = None
    pasted_text: str = ""


@dataclass(frozen=True)
class OutputPaths:
    excel: Path
    report: Path
    json: Path


Event = dict[str, Any]
