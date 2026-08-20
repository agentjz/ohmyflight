from __future__ import annotations

import unittest

from .common import APP_ROOT  # noqa: F401
from http_qualification_query.models import QueryRecord
from http_qualification_query.portal_client import (
    PortalClient,
    PortalSessionExpired,
    build_employee_query_params,
    parse_detail_table,
    parse_employee_identity,
)


SESSION_HTML = '<form id="showEmpProfileCompositeListPageForm"></form>'
EMPLOYEE_HTML = """
<div class="flexigrid">
  <div class="hDiv"><table><tr>
    <th>选择</th><th>员工号</th><th>姓名</th><th>状态</th>
  </tr></table></div>
  <div class="bDiv"><table><tbody><tr>
    <td></td><td><a>900001</a></td><td><a title="查看作风纪律资料">测试甲</a></td><td>在职</td>
  </tr></tbody></table></div>
</div>
"""
TECHNICAL_HTML = """
<div id="qualList">
  <table><tr><th>#</th><th>技术等级代码</th><th>技术等级</th><th>水平等级</th><th>机型</th><th>生效时间</th><th>失效时间</th><th>对应检查记录</th><th>数据来源</th></tr></table>
  <table><tbody><tr><td>1</td><td><span title="CAP">C</span></td><td>机长</td><td>一级</td><td>A320</td><td>2025-01-01</td><td>2026-01-01</td><td>检查记录</td><td>门户</td></tr></tbody></table>
</div>
"""
OPERATION_HTML = """
<div id="showSingleEmpOperQualList">
  <table><tr><th>类型</th><th>运行资格代码</th><th>运行资格</th><th>水平等级</th><th>机型</th><th>生效时间</th><th>失效时间</th><th>备注</th></tr></table>
  <table><tbody>
    <tr><td rowspan="2">航线</td><td>R1</td><td><span title="区域资格一">资格一</span></td><td>一级</td><td>A320</td><td>2025-01-01</td><td>2026-01-01</td><td></td></tr>
    <tr><td>R2</td><td>区域资格二</td><td>二级</td><td>A320</td><td>2025-02-01</td><td>2026-02-01</td><td>样例</td></tr>
  </tbody></table>
</div>
"""


class FakeResponse:
    def __init__(self, text: str, url: str = "https://ieb.csair.com/ok", status: int = 200):
        self.text = text
        self.url = url
        self.status_code = status

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


class FakeCookies:
    def __init__(self) -> None:
        self.values: dict[str, str] = {}

    def clear(self) -> None:
        self.values.clear()

    def set(self, name: str, value: str, **_kwargs: object) -> None:
        self.values[name] = value


class FakeSession:
    def __init__(self, get_responses=None, post_responses=None):
        self.headers: dict[str, str] = {}
        self.cookies = FakeCookies()
        self.get_responses = list(get_responses or [])
        self.post_responses = list(post_responses or [])
        self.calls: list[tuple[str, str, dict[str, object]]] = []
        self.closed = False

    def get(self, url: str, **kwargs: object) -> FakeResponse:
        self.calls.append(("GET", url, kwargs))
        return self.get_responses.pop(0)

    def post(self, url: str, **kwargs: object) -> FakeResponse:
        self.calls.append(("POST", url, kwargs))
        return self.post_responses.pop(0)

    def close(self) -> None:
        self.closed = True


class PortalClientTests(unittest.TestCase):
    def test_employee_params_preserve_both_active_status_values(self) -> None:
        params = build_employee_query_params("900001", "123")
        self.assertEqual(
            [value for key, value in params if key == "activeStatusArray"],
            ["ZAIZHI", "WAIBU"],
        )
        self.assertIn(("personName", "900001"), params)
        self.assertIn(("currentStr", "123"), params)

    def test_parses_separate_tables_titles_and_rowspans(self) -> None:
        identity = parse_employee_identity(EMPLOYEE_HTML, "900001", "测试甲")
        technical = parse_detail_table(TECHNICAL_HTML, "#qualList")
        operation = parse_detail_table(OPERATION_HTML, "#showSingleEmpOperQualList")

        self.assertEqual(identity, {"employeeId": "900001", "name": "测试甲"})
        self.assertEqual(technical[0]["技术等级代码"], "CAP")
        self.assertEqual(operation[0]["运行资格"], "区域资格一")
        self.assertEqual(operation[1]["类型"], "航线")
        self.assertEqual(operation[1]["运行资格代码"], "R2")

    def test_query_uses_verified_session_and_three_real_endpoints(self) -> None:
        session = FakeSession(
            get_responses=[FakeResponse(SESSION_HTML), FakeResponse(EMPLOYEE_HTML)],
            post_responses=[FakeResponse(TECHNICAL_HTML), FakeResponse(OPERATION_HTML)],
        )
        client = PortalClient(session=session)
        summary = client.load_credentials("JSESSIONID=a; iebJSid=b")
        result = client.query(QueryRecord(1, "900001", "测试甲", "样例"))

        self.assertTrue(summary["verifiedAt"])
        self.assertEqual(result.page_name, "测试甲")
        self.assertEqual((len(result.technical_rows), len(result.operation_rows)), (1, 2))
        employee_call = session.calls[1]
        self.assertEqual(employee_call[0], "GET")
        statuses = [value for key, value in employee_call[2]["params"] if key == "activeStatusArray"]
        self.assertEqual(statuses, ["ZAIZHI", "WAIBU"])
        self.assertTrue(session.calls[2][1].endswith("/newieb/basics/qualList"))
        self.assertEqual(session.calls[2][2]["data"]["staffNum"], "900001")
        self.assertTrue(session.calls[3][1].endswith("/newieb/basics/showSingleEmpOperQualListByempIdNew"))
        self.assertEqual(session.calls[3][2]["data"]["empid"], "900001")

    def test_rejects_login_response(self) -> None:
        session = FakeSession(get_responses=[FakeResponse("<div id='scanLogin'></div>", "https://ieb.csair.com/login")])
        with self.assertRaises(PortalSessionExpired):
            PortalClient(session=session).load_credentials("JSESSIONID=a; iebJSid=b")


if __name__ == "__main__":
    unittest.main()
