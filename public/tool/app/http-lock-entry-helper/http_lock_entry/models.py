"""Stable models shared by the HTTP lock-entry modules."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


WorkbenchMode = Literal["original", "smart"]


@dataclass(frozen=True)
class LockTypeMetadata:
    code: str
    label: str
    description: str
    limit_flag: str
    date_split_flag: str

    @property
    def supports_monthly(self) -> bool:
        return self.limit_flag != "1" and self.code not in {"ALV_FD", "CRM"}

    @property
    def default_start_time(self) -> str:
        return "08:30" if self.code == "CRM" else "08:59"

    @property
    def default_end_time(self) -> str:
        return "16:30" if self.code == "CRM" else "19:59"


@dataclass(frozen=True)
class PortalMetadata:
    lock_types: dict[str, LockTypeMetadata]
    default_reason_prefix: str


@dataclass(frozen=True)
class EmployeeIdentity:
    employee_id: str
    name: str
    department: str


@dataclass(frozen=True)
class InputPayload:
    input_mode: str
    excel_name: str = ""
    excel_bytes: bytes | None = None
    pasted_text: str = ""
    whitelist_text: str = ""
    common_reason: str = ""
    conflict_recovery: bool = False


@dataclass(frozen=True)
class BatchRunConfig:
    run_id: str
    mode: WorkbenchMode
    output_directory: str
    input_payload: InputPayload


@dataclass(frozen=True)
class SubmitResult:
    result_rows: list[dict[str, str]]
    conflict_rows: list[dict[str, str]]
