from __future__ import annotations

from datetime import datetime
from threading import Event, Lock, Thread, current_thread
from typing import Callable

from .errors import SessionExpiredError


class SessionKeepAlive:
    """按随机间隔执行只读会话检查，并维护脱敏状态。"""

    def __init__(self, interval_factory: Callable[[], int], timeout_seconds: int) -> None:
        self.interval_factory = interval_factory
        self.timeout_seconds = timeout_seconds
        self.lock = Lock()
        self.stop_event = Event()
        self.thread: Thread | None = None
        self.state = "stopped"
        self.last_checked_at = ""
        self.next_interval_seconds = 0
        self.error = ""

    def start(self, check: Callable[[], None]) -> None:
        self.stop_event = Event()
        self.thread = Thread(
            target=self._run,
            args=(check,),
            name="flight-portal-cookie-keepalive",
            daemon=True,
        )
        self.thread.start()

    def stop(self) -> None:
        self.stop_event.set()
        thread = self.thread
        if thread is not None and thread.is_alive() and thread is not current_thread():
            thread.join(timeout=self.timeout_seconds + 1)
        with self.lock:
            self.thread = None
            self.state = "stopped"
            self.next_interval_seconds = 0
            self.error = ""

    def record_success(self) -> None:
        with self.lock:
            self.state = "healthy"
            self.error = ""
            self.last_checked_at = self._now()

    def mark_expired(self) -> None:
        self.stop_event.set()
        with self.lock:
            self.state = "expired"
            self.last_checked_at = self._now()
            self.next_interval_seconds = 0
            self.error = ""

    def status(self, ready: bool) -> dict[str, object]:
        with self.lock:
            return {
                "state": self.state,
                "running": bool(ready and self.thread is not None and self.thread.is_alive()),
                "lastCheckedAt": self.last_checked_at,
                "nextIntervalSeconds": self.next_interval_seconds,
                "error": self.error,
            }

    def _run(self, check: Callable[[], None]) -> None:
        while not self.stop_event.is_set():
            interval = max(1, int(self.interval_factory()))
            with self.lock:
                self.next_interval_seconds = interval
            if self.stop_event.wait(interval):
                break
            with self.lock:
                self.state = "checking"
            try:
                check()
            except SessionExpiredError:
                self.mark_expired()
                break
            except Exception as error:
                with self.lock:
                    self.state = "error"
                    self.error = str(error)
                    self.last_checked_at = self._now()
            else:
                self.record_success()

    @staticmethod
    def _now() -> str:
        return datetime.now().isoformat(timespec="seconds")
