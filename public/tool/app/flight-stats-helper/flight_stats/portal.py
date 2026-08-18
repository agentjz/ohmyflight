from __future__ import annotations

import re
import time
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Callable


SHORT_WAIT_MS = 80
MEDIUM_WAIT_MS = 150
QUERY_WAIT_MS = 1000
QUERY_REFRESH_TIMEOUT_SECONDS = 10
DATE_PICKER_FRAME = "iframe >> nth=2"
RESULT_CONTAINER = "#flyTimeExperienceListDiv"


@dataclass(frozen=True)
class TableResult:
    headers: list[str]
    values: dict[str, str]


def _clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def parse_result_table(
    payload: dict[str, Any],
    expected_employee_id: str,
    expected_name: str = "",
) -> TableResult:
    headers = [_clean_text(value) for value in payload.get("headers", [])]
    rows = payload.get("rows", [])
    if not headers:
        raise ValueError("结果表缺少可见表头")
    if any(not header for header in headers):
        raise ValueError("结果表存在空白表头")
    if len(set(headers)) != len(headers):
        raise ValueError("结果表存在重复表头")

    for raw_row in rows:
        values = [_clean_text(value) for value in raw_row]
        if len(values) != len(headers):
            raise ValueError("结果表表头和数据列数不一致")
        row = dict(zip(headers, values))
        if row.get("员工号") != str(expected_employee_id):
            continue
        expected_name = _clean_text(expected_name)
        if expected_name and row.get("姓名", "") != expected_name:
            raise ValueError(
                f"姓名不匹配：期望 {expected_name}，页面为 {row.get('姓名', '')}"
            )
        return TableResult(headers=headers, values=row)

    raise ValueError(f"员工号不匹配：结果中未找到 {expected_employee_id}")


def _table_payload(page: Any) -> dict[str, Any]:
    return page.evaluate(
        """
        () => {
          const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim();
          const container = document.querySelector('#flyTimeExperienceListDiv');
          const table = container && container.querySelector('table.table-bordered');
          if (!table) return {headers: [], rows: []};
          const headerCells = Array.from(table.querySelectorAll('thead th'));
          const headers = headerCells.map((cell) => clean(cell.innerText || cell.textContent));
          const rows = Array.from(table.querySelectorAll('tbody.list tr')).map((row) =>
            Array.from(row.children)
              .filter((cell) => cell.tagName === 'TD')
              .map((cell) => clean(cell.innerText || cell.textContent))
          );
          return {headers, rows};
        }
        """
    )


def _table_snapshot(page: Any) -> str:
    try:
        return page.locator(f"{RESULT_CONTAINER} tbody.list").inner_text(timeout=1000).strip()
    except Exception:
        return ""


def _date_value(value: str) -> date | None:
    match = re.search(r"(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", str(value or ""))
    if not match:
        return None
    try:
        return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    except ValueError:
        return None


def _click_current_month_day(frame: Any, day: str) -> None:
    cells = frame.get_by_role("cell", name=day, exact=True)
    fallback = None
    for index in range(cells.count()):
        cell = cells.nth(index)
        fallback = fallback or cell
        class_name = (cell.get_attribute("class") or "").lower()
        if any(keyword in class_name for keyword in ("old", "new", "other", "disabled", "muted")):
            continue
        cell.click()
        return
    if fallback is None:
        raise ValueError(f"日期面板没有找到日期 {day}")
    fallback.click()


def _fill_date(page: Any, date_value: date) -> None:
    month_map = {
        1: "一月", 2: "二月", 3: "三月", 4: "四月", 5: "五月", 6: "六月",
        7: "七月", 8: "八月", 9: "九月", 10: "十月", 11: "十一", 12: "十二",
    }
    page.wait_for_timeout(MEDIUM_WAIT_MS)
    frame = page.frame_locator(DATE_PICKER_FRAME)
    frame.get_by_role("textbox").nth(1).click()
    page.wait_for_timeout(SHORT_WAIT_MS)
    frame.get_by_role("cell", name=str(date_value.year), exact=True).click()
    page.wait_for_timeout(SHORT_WAIT_MS)
    frame.get_by_role("textbox").first.click()
    page.wait_for_timeout(SHORT_WAIT_MS)
    frame.get_by_role("cell", name=month_map[date_value.month], exact=True).click()
    page.wait_for_timeout(SHORT_WAIT_MS)
    _click_current_month_day(frame, str(date_value.day))
    page.wait_for_timeout(SHORT_WAIT_MS)


class PortalClient:
    def __init__(self, page: Any, emit: Callable[[dict[str, Any]], None] | None = None):
        self.page = page
        self.emit = emit or (lambda _event: None)

    def _status(self, phase: str, message: str) -> None:
        self.emit({"type": "status", "phase": phase, "message": message})

    def login_and_open(self) -> None:
        self._status("starting", "正在打开登录页")
        self.page.goto("https://ieb.csair.com/login", wait_until="domcontentloaded", timeout=60000)
        self.page.locator("#scanLogin").click(timeout=30000)
        self._status("waiting_login", "请在浏览器中扫码登录")
        self.page.wait_for_url("**/index/**", timeout=600000)
        self._status("starting", "登录成功，正在打开门户首页")
        try:
            self.page.goto("https://ieb.csair.com/index/index", wait_until="domcontentloaded", timeout=60000)
            self._status("starting", "正在进入统计应用")
            self.page.get_by_role("listitem").filter(has_text="统计应用").locator("span").click(timeout=30000)
            self._status("starting", "正在进入综合报表")
            self.page.get_by_role("link", name="综合报表").click(timeout=30000)
            self._status("starting", "正在进入飞行经历页面")
            self.page.get_by_role("link", name="飞行经历", exact=True).click(timeout=30000)
            self.page.locator("#flyTimeExperience_beginDate").wait_for(state="visible", timeout=30000)
            if self._ensure_daily_mode():
                self._status("prepared", "飞行经历页面已就绪，已选择按天查询，等待人工操作")
            else:
                self._status("prepared", "飞行经历页面已就绪，请确认按天查询，等待人工操作")
        except Exception as error:
            self.emit(
                {
                    "type": "log",
                    "level": "warning",
                    "message": f"自动进入飞行经历页面失败，请在浏览器中手动进入：{error}",
                }
            )
            self._status("prepared", "请手动进入飞行经历页面，完成后执行数据健康检查")

    def _ensure_daily_mode(self) -> bool:
        """用页面脚本点击按天选项，门户自定义 onclick 时不强制校验 locator 状态。"""
        try:
            selected = self.page.evaluate(
                """
                () => {
                  const direct = document.querySelector('input[name="dateType"][value="5"]');
                  if (direct) {
                    direct.click();
                    return direct.checked;
                  }
                  const labels = Array.from(document.querySelectorAll('label'));
                  const target = labels.find((label) => label.innerText && label.innerText.includes('按天查询'));
                  if (!target) return false;
                  const input = target.querySelector('input[type="radio"]');
                  if (input) {
                    input.click();
                    return input.checked;
                  }
                  target.click();
                  return true;
                }
                """
            )
            if selected:
                self.page.wait_for_timeout(SHORT_WAIT_MS)
                return True
        except Exception:
            pass
        try:
            fallback = self.page.get_by_role("radio").nth(2)
            fallback.click(force=True)
            self.page.wait_for_timeout(SHORT_WAIT_MS)
            return bool(fallback.is_checked())
        except Exception as error:
            self.emit({"type": "log", "level": "warning", "message": f"请人工确认按天查询模式：{error}"})
            return False

    def _fill_employee(self, employee_id: str) -> None:
        visible_input = self.page.locator("#showFlyTimeStaffNum")
        visible_input.click()
        visible_input.fill("")
        visible_input.type(employee_id, delay=20)
        self.page.wait_for_timeout(MEDIUM_WAIT_MS)
        self.page.wait_for_function(
            "(expected) => document.querySelector('#staffNum')?.value === expected",
            arg=employee_id,
            timeout=5000,
        )

    def _fill_dates(self, start_date: date, end_date: date, clear_first: bool) -> None:
        begin = self.page.locator("#flyTimeExperience_beginDate")
        begin.click()
        self.page.wait_for_timeout(MEDIUM_WAIT_MS)
        if clear_first:
            begin.click()
            self.page.wait_for_timeout(MEDIUM_WAIT_MS)
        _fill_date(self.page, start_date)

        if end_date == date.today():
            return
        end = self.page.locator("#flyTimeExperience_endDate")
        end.click()
        self.page.wait_for_timeout(MEDIUM_WAIT_MS)
        if clear_first:
            end.click()
            self.page.wait_for_timeout(MEDIUM_WAIT_MS)
        _fill_date(self.page, end_date)

    def _wait_refresh(self, previous: str, employee_id: str, name: str) -> None:
        deadline = time.monotonic() + QUERY_REFRESH_TIMEOUT_SECONDS
        latest = previous
        while time.monotonic() < deadline:
            latest = _table_snapshot(self.page)
            if employee_id in latest or (name and name in latest):
                return
            if latest != previous:
                self.page.wait_for_timeout(MEDIUM_WAIT_MS)
                return
            self.page.wait_for_timeout(MEDIUM_WAIT_MS)
        raise RuntimeError(f"查询结果未刷新：{employee_id} {name}；当前结果 {latest[:120]}")

    def query(self, record: Any, clear_first: bool = False) -> TableResult:
        self._ensure_daily_mode()
        previous = _table_snapshot(self.page)
        self._fill_employee(record.employee_id)
        self._fill_dates(record.start_date, record.end_date, clear_first)
        actual_start = _date_value(self.page.locator("#flyTimeExperience_beginDate").input_value())
        actual_end = _date_value(self.page.locator("#flyTimeExperience_endDate").input_value())
        if actual_start != record.start_date or actual_end != record.end_date:
            raise RuntimeError(
                f"页面日期校验失败：期望 {record.start_date}~{record.end_date}，"
                f"实际 {actual_start}~{actual_end}"
            )
        self.page.get_by_role("button", name="查询", exact=True).click()
        self.page.wait_for_timeout(QUERY_WAIT_MS)
        self._wait_refresh(previous, record.employee_id, record.name)
        return parse_result_table(_table_payload(self.page), record.employee_id, record.name)
