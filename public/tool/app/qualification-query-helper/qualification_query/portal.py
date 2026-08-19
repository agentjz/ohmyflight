from __future__ import annotations

import re
import time
from typing import Any, Callable

from .models import Event, QueryRecord, QueryResult


BASE_URL = "https://ieb.csair.com"
TECHNICAL_HEADERS = {"#", "技术等级代码", "技术等级", "水平等级", "机型", "生效时间", "失效时间"}
OPERATION_HEADERS = {"类型", "运行资格代码", "运行资格", "水平等级", "机型", "生效时间", "失效时间", "备注"}


class PortalError(RuntimeError):
    pass


class PortalSessionExpired(PortalError):
    pass


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\xa0", " ")).strip()


def is_browser_closed_error(error: Exception) -> bool:
    message = str(error).lower()
    return any(
        marker in message
        for marker in (
            "target page, context or browser has been closed",
            "browser has been closed",
            "page has been closed",
        )
    )


def click_first(candidates: list[Any], label: str, timeout: int = 10000) -> None:
    last_error: Exception | None = None
    for locator in candidates:
        try:
            locator.first.wait_for(state="visible", timeout=timeout)
            locator.first.click(timeout=timeout)
            return
        except Exception as error:
            last_error = error
    raise PortalError(f"未能点击{label}: {last_error}")


EXTRACT_TABLE_JS = r"""
(container) => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const parseTable = (table, expectedCols) => {
    const active = new Map();
    const result = [];
    for (const tr of Array.from(table.querySelectorAll('tr'))) {
      const values = [];
      let column = 0;
      const consumeActive = () => {
        const entry = active.get(column);
        values.push(entry.text);
        if (entry.rowsLeft <= 1) active.delete(column);
        else active.set(column, { text: entry.text, rowsLeft: entry.rowsLeft - 1 });
        column += 1;
      };
      const cells = Array.from(tr.children).filter((cell) => cell.tagName === 'TH' || cell.tagName === 'TD');
      for (const cell of cells) {
        while (active.has(column)) consumeActive();
        const text = clean(cell.innerText);
        const rowspan = Number(cell.getAttribute('rowspan') || 1);
        const colspan = Number(cell.getAttribute('colspan') || 1);
        for (let offset = 0; offset < colspan; offset += 1) {
          values.push(text);
          if (rowspan > 1) active.set(column + offset, { text, rowsLeft: rowspan - 1 });
        }
        column += colspan;
      }
      const limit = expectedCols || Math.max(values.length, ...Array.from(active.keys(), (key) => key + 1), 0);
      while (column < limit) {
        if (active.has(column)) consumeActive();
        else {
          values.push('');
          column += 1;
        }
      }
      if (values.some(Boolean)) result.push(values);
    }
    return result;
  };
  const tables = Array.from(container.querySelectorAll('table'));
  if (tables.length < 2) return { headers: [], rows: [], tableCount: tables.length };
  const headers = parseTable(tables[0], 0)[0] || [];
  const rows = parseTable(tables[1], headers.length);
  return { headers, rows, tableCount: tables.length };
}
"""


READ_NAME_JS = r"""
(targetId) => {
  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  for (const row of Array.from(document.querySelectorAll('tr'))) {
    const values = Array.from(row.querySelectorAll('th,td')).map((cell) => clean(cell.innerText));
    const index = values.findIndex((value) => value === targetId);
    if (index >= 0) {
      const name = values.slice(index + 1).find((value) => /^[\u4e00-\u9fa5·]{2,8}$/.test(value));
      if (name) return name;
    }
  }
  return '';
}
"""


class PortalClient:
    def __init__(self, page: Any, emit: Callable[[Event], None] | None = None):
        self.page = page
        self.emit = emit or (lambda _event: None)

    def _status(self, message: str) -> None:
        self.emit({"type": "status", "phase": "starting", "message": message})

    def open_material_management(self) -> None:
        self._status("正在验证飞行门户登录态")
        self.page.goto(f"{BASE_URL}/index/index")
        try:
            self.page.wait_for_load_state("networkidle", timeout=10000)
        except Exception:
            pass
        if "/login" in str(self.page.url or "") or self.page.locator("#scanLogin").count() > 0:
            raise PortalSessionExpired("登录 Cookie 已失效，请重新复制")
        self.emit({"type": "log", "level": "success", "message": "登录态验证成功"})

        self._status("正在进入资质管理")
        click_first([self.page.get_by_text("资质管理").nth(1), self.page.get_by_text("资质管理")], "资质管理")
        self._status("正在进入飞行训练")
        click_first([self.page.get_by_text("飞行训练").nth(1), self.page.get_by_text("飞行训练")], "飞行训练")
        self._status("正在进入技术资料")
        click_first([self.page.get_by_role("link", name="技术资料"), self.page.get_by_text("技术资料")], "技术资料")
        self._status("正在进入资料管理")
        click_first([self.page.get_by_role("link", name="资料管理"), self.page.get_by_text("资料管理")], "资料管理")
        self.page.get_by_role("textbox", name="员工号或姓名简拼").wait_for(state="visible", timeout=12000)
        self.emit({"type": "log", "level": "success", "message": "资料管理页面已就绪"})

    def _wait_for_search_result(self, employee_id: str, timeout_ms: int = 10000) -> None:
        deadline = time.monotonic() + timeout_ms / 1000
        while time.monotonic() < deadline:
            if self.page.get_by_role("link", name=employee_id, exact=True).count() > 0:
                return
            self.page.wait_for_timeout(200)
        raise PortalError(f"查询后未找到员工号链接: {employee_id}")

    def _read_name(self, employee_id: str) -> str:
        for frame in self.page.frames:
            try:
                name = normalize_text(frame.evaluate(READ_NAME_JS, employee_id))
                if name:
                    return name
            except Exception:
                continue
        return ""

    def _search_employee(self, employee_id: str) -> str:
        textbox = self.page.get_by_role("textbox", name="员工号或姓名简拼")
        textbox.click()
        textbox.fill("")
        textbox.type(employee_id, delay=20)
        self.page.get_by_role("button", name="查询").click()
        self._wait_for_search_result(employee_id)
        page_name = self._read_name(employee_id)
        self.page.get_by_role("link", name=employee_id, exact=True).click()
        self.page.wait_for_timeout(600)
        return page_name

    def _wait_for_container(self, selector: str, timeout_ms: int = 8000) -> None:
        deadline = time.monotonic() + timeout_ms / 1000
        while time.monotonic() < deadline:
            for frame in self.page.frames:
                try:
                    if frame.locator(selector).count() > 0:
                        return
                except Exception:
                    continue
            self.page.wait_for_timeout(200)
        raise PortalError(f"未找到目标容器: {selector}")

    def _extract_table(self, selector: str) -> tuple[list[str], list[dict[str, str]]]:
        self._wait_for_container(selector)
        last_error: Exception | None = None
        for frame in self.page.frames:
            try:
                locator = frame.locator(selector)
                if locator.count() == 0:
                    continue
                parsed = locator.first.evaluate(EXTRACT_TABLE_JS)
                headers = [normalize_text(value) for value in parsed.get("headers", [])]
                rows = [
                    dict(zip(headers, [normalize_text(value) for value in values[:len(headers)]]))
                    for values in parsed.get("rows", [])
                    if any(normalize_text(value) for value in values)
                ]
                return headers, rows
            except Exception as error:
                last_error = error
        raise PortalError(f"读取目标容器失败: {selector}: {last_error}")

    def _read_tab(self, label: str, selector: str, required_headers: set[str]) -> list[dict[str, str]]:
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                click_first(
                    [self.page.get_by_role("link", name=label, exact=True), self.page.get_by_text(label, exact=True)],
                    label,
                )
                headers, rows = self._extract_table(selector)
                if not required_headers.issubset(set(headers)):
                    raise PortalError(f"{label}表头异常: {headers}")
                return rows
            except Exception as error:
                last_error = error
                if attempt == 0:
                    self.page.wait_for_timeout(1000)
        raise PortalError(str(last_error))

    def _close_person_dialog(self) -> None:
        try:
            close_button = self.page.locator(".pilotInfo-dialog-close")
            if close_button.count() > 0:
                close_button.first.click(timeout=5000)
                self.page.wait_for_timeout(400)
        except Exception:
            pass

    def query(self, record: QueryRecord) -> QueryResult:
        page_name = self._search_employee(record.employee_id)
        try:
            technical_rows = self._read_tab("技术等级", "#qualList", TECHNICAL_HEADERS)
            operation_rows = self._read_tab("运行资格", "#showSingleEmpOperQualList", OPERATION_HEADERS)
            return QueryResult(page_name, technical_rows, operation_rows)
        finally:
            self._close_person_dialog()
