from __future__ import annotations

import json
import threading
import unittest
from collections import deque

from .common import CATALOG_ROOT
from api_docs.catalog import ApiCatalog
from api_docs.executor import ApiExecutor
from api_docs.systems.flight_portal import random_keepalive_interval


QUERY_PAGE_HTML = """
<form id="showflyTimeExperienceQueryForm" action="/newieb/flytime/showFlytimeManyQueryList"></form>
"""

ENTRY_HTML = """
<div id="showNonproductionTaskImportPage">
  <form id="nonproductionTaskImportForm">
    <select id="lockType">
      <option value=""></option>
      <option value="BS_STUDY" class="0" id="0">【BS_STUDY】业务学习</option>
      <option value="RECU_LVE" class="1" id="1">【RECU_LVE】健康疗养</option>
    </select>
  </form>
</div>
"""

FLIGHT_RESULT_HTML = """
<table>
  <thead><tr><th>员工号</th><th>姓名</th><th>飞行时间</th><th>起落总数</th></tr></thead>
  <tbody><tr><td>900001</td><td>测试人员</td><td>12:30</td><td>8</td></tr></tbody>
</table>
"""

LOCK_RESULT_HTML = """
<div id="showNonproductionTaskImportResultPage1">
  <div class="hDiv"><table><thead><tr><th>锁班状态</th><th>员工号</th><th>锁班类型</th></tr></thead></table></div>
  <div class="bDiv"><table><tbody class="list"><tr><td>待审批</td><td>900001</td><td>BS_STUDY</td></tr></tbody></table></div>
</div>
<div id="showNonproductionTaskImportResultPage2">
  <div class="hDiv"><table><thead><tr><th>锁班结果</th><th>冲突说明</th></tr></thead></table></div>
  <div class="bDiv"><table><tbody class="list"><tr><td colspan="2">没有相关信息</td></tr></tbody></table></div>
</div>
"""

BASIC_INFO_JSON = json.dumps({
    "empDto": {"birthDate": "2000-01-01", "position": "飞行员"},
    "eduList": [{"school": "样例院校", "education": "本科"}],
    "workList": [],
    "titleList": [],
    "relationList": [],
}, ensure_ascii=False)

TECHNICAL_RESULT_HTML = """
<div id="qualList">
  <table><tr><th>#</th><th>技术等级代码</th><th>技术等级</th></tr></table>
  <table><tbody><tr><td>1</td><td>CAP</td><td>机长</td></tr></tbody></table>
</div>
"""


class FakeCookies:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}

    def set(self, name: str, value: str, **_options: object) -> None:
        self.values[name] = value


class FakeResponse:
    def __init__(
        self,
        text: str,
        url: str = "https://ieb.example.test/result",
        content_type: str = "text/html; charset=utf-8",
    ) -> None:
        self.text = text
        self.url = url
        self.status_code = 200
        self.reason = "OK"
        self.headers = {"Content-Type": content_type, "Set-Cookie": "secret=value"}


class FakeSession:
    def __init__(self, responses: list[FakeResponse], request_event: threading.Event | None = None) -> None:
        self.headers: dict[str, str] = {}
        self.cookies = FakeCookies()
        self.responses = deque(responses)
        self.requests: list[dict[str, object]] = []
        self.closed = False
        self.request_event = request_event

    def request(self, **kwargs: object) -> FakeResponse:
        self.requests.append(kwargs)
        if self.request_event is not None and len(self.requests) > 1:
            self.request_event.set()
        return self.responses.popleft()

    def close(self) -> None:
        self.closed = True


class ExecutorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.catalog = ApiCatalog(CATALOG_ROOT)

    def create_executor(
        self,
        responses: list[FakeResponse],
        *,
        keepalive_interval: int = 60,
        request_event: threading.Event | None = None,
    ) -> tuple[ApiExecutor, FakeSession]:
        session = FakeSession(responses, request_event)
        executor = ApiExecutor(
            self.catalog,
            session_factory=lambda: session,
            keepalive_interval_factory=lambda: keepalive_interval,
        )
        self.addCleanup(executor.close)
        return executor, session

    def test_cookie_validation_does_not_load_lock_types(self) -> None:
        executor, session = self.create_executor([FakeResponse(QUERY_PAGE_HTML), FakeResponse(ENTRY_HTML)])
        result = executor.load_credentials("JSESSIONID=session-value; iebJSid=browser-value")
        self.assertTrue(result["ready"])
        self.assertEqual(
            result["credentials"],
            "JSESSIONID=session-value; iebJSid=browser-value",
        )
        self.assertNotIn("credentials", executor.session_status())
        self.assertNotIn("lockTypeCount", result)
        self.assertEqual(len(session.requests), 1)
        self.assertEqual(
            session.requests[0]["url"],
            self.catalog.get_internal_request("flight-stats.query-page").url,
        )

        options = executor.load_options("lock-types")
        self.assertEqual(len(session.requests), 2)
        self.assertEqual(options[0]["value"], "BS_STUDY")
        self.assertEqual(
            session.requests[1]["url"],
            self.catalog.get_internal_request("lock-entry.entry-page").url,
        )

    def test_flight_query_returns_table_json_and_raw_body(self) -> None:
        executor, session = self.create_executor([FakeResponse(QUERY_PAGE_HTML), FakeResponse(FLIGHT_RESULT_HTML)])
        executor.load_credentials("JSESSIONID=session-value; iebJSid=browser-value")
        result = executor.execute("flight-stats.query", {
            "staffNum": "900001",
            "startStr": "2026-01-01",
            "endStr": "2026-08-20",
        })
        table = result["data"]["tables"][0]
        self.assertEqual(table["columns"], ["员工号", "姓名", "飞行时间", "起落总数"])
        self.assertEqual(table["rows"][0]["飞行时间"], "12:30")
        self.assertEqual(result["data"]["summary"]["recordCount"], 1)
        self.assertEqual(result["body"], FLIGHT_RESULT_HTML)
        self.assertNotIn("Set-Cookie", result["headers"])
        self.assertEqual(session.requests[-1]["method"], "GET")

    def test_lock_submit_uses_lazy_metadata_and_employee_validation(self) -> None:
        identity = json.dumps({
            "permissionFlag": "true",
            "nameInfo": "测试人员",
            "deptInfo": "测试部门",
        }, ensure_ascii=False)
        executor, session = self.create_executor([
            FakeResponse(QUERY_PAGE_HTML),
            FakeResponse(ENTRY_HTML),
            FakeResponse(identity, content_type="application/json"),
            FakeResponse(LOCK_RESULT_HTML),
        ])
        executor.load_credentials("JSESSIONID=session-value; iebJSid=browser-value")
        result = executor.execute("lock-entry.submit", {
            "staffnum": "900001",
            "lockType": "BS_STUDY",
            "lockTimeType": "1",
            "startDt": "2026-10-08T08:59",
            "endDt": "2026-10-08T19:59",
            "lockRemark": "测试备注",
        })
        self.assertEqual([table["id"] for table in result["data"]["tables"]], ["results", "conflicts"])
        self.assertEqual(result["data"]["tables"][0]["rows"][0]["锁班状态"], "待审批")
        self.assertEqual(
            result["data"]["summary"],
            {"resultCount": 1, "conflictCount": 0, "outcome": "已返回锁班结果"},
        )
        submit_data = session.requests[-1]["data"]
        self.assertIn(("lockTypeDesc", "业务学习"), submit_data)
        self.assertIn(("chnName", "测试人员"), submit_data)
        self.assertIn(("orgUnitName", "测试部门"), submit_data)
        self.assertIn(("lockDays", "1"), submit_data)
        self.assertEqual(
            session.requests[-2]["url"],
            self.catalog.get_internal_request("lock-entry.employee-validation").url,
        )

    def test_personnel_info_executes_multipart_json_and_html_table_requests(self) -> None:
        executor, session = self.create_executor([
            FakeResponse(QUERY_PAGE_HTML),
            FakeResponse(BASIC_INFO_JSON, content_type="application/json"),
            FakeResponse(TECHNICAL_RESULT_HTML),
        ])
        executor.load_credentials("JSESSIONID=session-value; iebJSid=browser-value")

        basic = executor.execute("personnel-info.basic", {"staffNum": "900001"})
        self.assertEqual([table["id"] for table in basic["data"]["tables"]], [
            "empDto", "eduList", "workList", "titleList", "relationList",
        ])
        self.assertEqual(session.requests[-1]["files"], {"staffNum": (None, "900001")})
        self.assertIsNone(session.requests[-1]["data"])

        technical = executor.execute("personnel-info.technical", {"staffNum": "900001"})
        self.assertEqual(technical["data"]["summary"]["recordCount"], 1)
        self.assertEqual(technical["data"]["tables"][0]["rows"][0]["技术等级"], "机长")
        self.assertIn(("staffNum", "900001"), session.requests[-1]["data"])

    def test_verified_cookie_is_kept_alive_with_read_only_query_page(self) -> None:
        request_event = threading.Event()
        executor, session = self.create_executor(
            [FakeResponse(QUERY_PAGE_HTML), FakeResponse(QUERY_PAGE_HTML)],
            keepalive_interval=1,
            request_event=request_event,
        )
        result = executor.load_credentials("JSESSIONID=session-value; iebJSid=browser-value")
        self.assertTrue(result["keepAlive"]["running"])
        self.assertTrue(request_event.wait(timeout=2.5))
        self.assertEqual(session.requests[1]["method"], "GET")
        self.assertIn("showFlytimeManyQuery", str(session.requests[1]["url"]))
        self.assertIsNone(session.requests[1]["data"])

    def test_keepalive_interval_stays_within_requested_range(self) -> None:
        values = [random_keepalive_interval() for _ in range(200)]
        self.assertTrue(all(1 <= value <= 60 for value in values))


if __name__ == "__main__":
    unittest.main()
