from __future__ import annotations

import unittest

from .common import APP_ROOT  # noqa: F401
from http_qualification_query.models import QueryRecord
from http_qualification_query.portal_client import (
    BASIC_INFO_FIELDS,
    PortalClient,
    PortalSessionExpired,
    build_employee_query_params,
    parse_basic_payload,
    parse_detail_table,
    parse_employee_identity,
    parse_training_record_pages,
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
TRAINING_HEADERS = [
    "选择", "培训科目", "培训机型", "培训课时", "培训地点", "经办人",
    "教员", "培训时间", "培训結束时间", "训练结果", "考试成绩", "上传",
]


def training_html(page: int, count: int, last_page: int, headers: list[str] | None = None) -> str:
    values = headers or TRAINING_HEADERS
    header = "".join(f"<th>{value}</th>" for value in values)
    rows = "".join(
        "<tr>" + "".join(f"<td>{page}-{index}-{column}</td>" for column in range(len(values))) + "</tr>"
        for index in range(count)
    )
    links = "".join(
        f"<a href=\"javascript:goPageTwo('a','b','trainingRecordList','{number}',true);\">{number}</a>"
        for number in range(1, last_page + 1)
    )
    return f"<div id='showTrainingRecordListDiv'><table><tr>{header}</tr>{rows}</table>{links}</div>"


BASIC_PAYLOAD = {
    "empDto": {field: f"值-{field}" for _label, field in BASIC_INFO_FIELDS},
    "eduList": [{"school": "测试院校", "beginDate": "2020-01", "endDate": "2022-01", "education": "本科", "major": "专业", "studymode": "全日制"}],
    "workList": [{"workDept": "测试部门", "beginDate": "2022-01", "endDate": "", "workPost": "测试岗位"}],
    "titleList": [],
    "relationList": [{"memName": "家属甲", "memRelation": "亲属", "memBirthday": "", "politics": "", "memCorp": "", "memJob": ""}],
}


class FakeResponse:
    def __init__(self, text: str, url: str = "https://ieb.csair.com/ok", status: int = 200):
        self.text = text
        self.url = url
        self.status_code = status

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self) -> object:
        return __import__("json").loads(self.text)


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

    def test_parses_basic_sections_and_keeps_empty_title_list(self) -> None:
        basic = parse_basic_payload(BASIC_PAYLOAD)

        self.assertEqual(basic["基本信息"]["出生日期"], "值-birthDate")
        self.assertEqual(basic["教育经历"][0]["学校"], "测试院校")
        self.assertEqual(basic["工作经历"][0]["岗位"], "测试岗位")
        self.assertEqual(basic["职称信息"], [])
        self.assertEqual(basic["家庭信息"][0]["与本人关系"], "亲属")

    def test_training_record_pages_follow_reported_last_page_and_keep_source_page(self) -> None:
        pages = [training_html(1, 12, 2), training_html(2, 2, 2)]
        calls: list[int] = []

        def fetch(page: int) -> str:
            calls.append(page)
            return pages[page - 1]

        rows = parse_training_record_pages(fetch)

        self.assertEqual(calls, [1, 2])
        self.assertEqual(len(rows), 14)
        self.assertEqual(rows[0]["来源页码"], "1")
        self.assertEqual(rows[-1]["来源页码"], "2")

    def test_query_uses_verified_session_and_all_real_endpoints(self) -> None:
        session = FakeSession(
            get_responses=[FakeResponse(SESSION_HTML), FakeResponse(EMPLOYEE_HTML)],
            post_responses=[
                FakeResponse(__import__("json").dumps(BASIC_PAYLOAD, ensure_ascii=False)),
                FakeResponse(TECHNICAL_HTML),
                FakeResponse(OPERATION_HTML),
                FakeResponse(training_html(1, 2, 1)),
                FakeResponse(training_html(1, 3, 1, [
                    "全选", "序号", "训练日期", "训练机型", "训练科目", "类型", "检查单",
                    "结论", "上传", "审批过程", "证书下载",
                ]).replace("showTrainingRecordListDiv", "trainResultList")),
            ],
        )
        client = PortalClient(session=session)
        summary = client.load_credentials("JSESSIONID=a; iebJSid=b")
        result = client.query(QueryRecord(1, "900001", "测试甲", "样例"))

        self.assertTrue(summary["verifiedAt"])
        self.assertEqual(result.page_name, "测试甲")
        self.assertEqual((len(result.technical_rows), len(result.operation_rows)), (1, 2))
        self.assertEqual((len(result.training_record_rows), len(result.training_experience_rows)), (2, 3))
        self.assertEqual(len(result.education_rows), 1)
        employee_call = session.calls[1]
        self.assertEqual(employee_call[0], "GET")
        statuses = [value for key, value in employee_call[2]["params"] if key == "activeStatusArray"]
        self.assertEqual(statuses, ["ZAIZHI", "WAIBU"])
        self.assertTrue(session.calls[2][1].endswith("/newieb/hrInfo/showEmpInfo"))
        self.assertEqual(session.calls[2][2]["files"]["staffNum"], (None, "900001"))
        self.assertTrue(session.calls[3][1].endswith("/newieb/basics/qualList"))
        self.assertTrue(session.calls[4][1].endswith("/newieb/basics/showSingleEmpOperQualListByempIdNew"))
        self.assertTrue(session.calls[5][1].endswith("/newieb/basics/trainingRecordList"))
        self.assertTrue(session.calls[6][1].endswith("/newieb/basics/trainResultList"))

    def test_rejects_login_response(self) -> None:
        session = FakeSession(get_responses=[FakeResponse("<div id='scanLogin'></div>", "https://ieb.csair.com/login")])
        with self.assertRaises(PortalSessionExpired):
            PortalClient(session=session).load_credentials("JSESSIONID=a; iebJSid=b")


if __name__ == "__main__":
    unittest.main()
