from __future__ import annotations

from typing import Callable

import requests

from .catalog import ApiCatalog
from .systems.flight_portal import FlightPortalAdapter, random_keepalive_interval
from .systems.errors import ExecutionError, SessionExpiredError


class ApiExecutor:
    """按目录中的 systemId 将业务接口交给对应系统适配器。"""

    def __init__(
        self,
        catalog: ApiCatalog,
        session_factory: Callable[[], requests.Session] = requests.Session,
        timeout_seconds: int = 30,
        keepalive_interval_factory: Callable[[], int] = random_keepalive_interval,
    ) -> None:
        self.catalog = catalog
        self.adapters = {
            "flight-portal": FlightPortalAdapter(
                catalog,
                session_factory,
                timeout_seconds,
                keepalive_interval_factory,
            ),
        }

    @property
    def flight_portal(self) -> FlightPortalAdapter:
        return self.adapters["flight-portal"]

    def load_credentials(self, source: str) -> dict[str, object]:
        return self.flight_portal.load_credentials(source)

    def clear_credentials(self) -> None:
        self.flight_portal.clear_credentials()

    def session_status(self) -> dict[str, object]:
        return self.flight_portal.session_status()

    def load_options(self, source: str) -> list[dict[str, str]]:
        return self.flight_portal.load_options(source)

    def execute(self, endpoint_id: str, supplied: dict[str, object]) -> dict[str, object]:
        record = self.catalog.get_endpoint(endpoint_id)
        system_id = str(record.module.get("systemId", ""))
        adapter = self.adapters.get(system_id)
        if adapter is None:
            raise ExecutionError("接口所属系统没有本地执行器")
        return adapter.execute(record, supplied)

    def close(self) -> None:
        for adapter in self.adapters.values():
            adapter.close()


__all__ = ["ApiExecutor", "ExecutionError", "SessionExpiredError"]
