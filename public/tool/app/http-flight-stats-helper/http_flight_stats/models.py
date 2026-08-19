from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any


@dataclass(frozen=True)
class QueryRecord:
    employee_id: str
    name: str
    start_date: date
    end_date: date
    source: str


@dataclass(frozen=True)
class TableResult:
    headers: list[str]
    values: dict[str, str]


@dataclass(frozen=True)
class QueryOutcome:
    index: int
    record: QueryRecord
    status: str
    result: TableResult | None = None
    error: str = ""


@dataclass(frozen=True)
class BatchResult:
    outcomes: list[QueryOutcome]
    stopped: bool
    session_expired: bool

    @property
    def success(self) -> int:
        return sum(item.status == "成功" for item in self.outcomes)

    @property
    def failed(self) -> int:
        return len(self.outcomes) - self.success


@dataclass(frozen=True)
class InputPayload:
    input_mode: str
    excel_name: str = ""
    excel_bytes: bytes | None = None
    pasted_text: str = ""
    scope: str | list[str] = "all"


Event = dict[str, Any]

