from __future__ import annotations

import json
import unittest

from .common import CATALOG_ROOT
from api_docs.catalog import ApiCatalog


class CatalogTests(unittest.TestCase):
    def setUp(self) -> None:
        self.catalog = ApiCatalog(CATALOG_ROOT)

    def test_catalog_exposes_flight_portal_business_apis(self) -> None:
        modules = self.catalog.as_dict()["modules"]
        self.assertEqual(
            [module["name"] for module in modules],
            ["飞行经历查询接口", "飞行人员锁班接口", "飞行人员信息查询接口"],
        )
        self.assertEqual(
            list(self.catalog.endpoints),
            [
                "flight-stats.query",
                "lock-entry.submit",
                "personnel-info.basic",
                "personnel-info.technical",
                "personnel-info.operation",
                "personnel-info.training-records",
                "personnel-info.training-experiences",
            ],
        )
        personnel = modules[2]
        self.assertEqual(
            [group["name"] for group in personnel["groups"]],
            ["基础信息", "技术等级", "运行资格", "训练检查记录"],
        )

    def test_internal_request_facts_are_preserved_without_becoming_endpoints(self) -> None:
        modules = self.catalog.as_dict()["modules"]
        flight_internal = {item["id"] for item in modules[0]["internalRequests"]}
        lock_internal = {item["id"] for item in modules[1]["internalRequests"]}
        self.assertEqual(flight_internal, {"query-page", "query"})
        self.assertTrue({
            "entry-page",
            "employee-validation",
            "quota",
            "submit",
            "query-page",
            "query-first-page",
            "query-next-page",
            "approve",
            "withdraw",
            "unlock",
            "reject",
        }.issubset(lock_internal))
        serialized = json.dumps(self.catalog.as_dict(), ensure_ascii=False)
        self.assertIn("showNonproductionTaskImportPage", serialized)
        self.assertIn("importNonproductionTaskLockListToSoc", serialized)
        query_page = self.catalog.get_internal_request("flight-stats.query-page")
        employee_validation = self.catalog.get_internal_request("lock-entry.employee-validation")
        self.assertEqual(query_page.endpoint["method"], "GET")
        self.assertTrue(query_page.url.endswith("/newieb/flytime/showFlytimeManyQuery"))
        self.assertEqual(employee_validation.endpoint["method"], "POST")
        self.assertTrue(employee_validation.url.endswith("/newieb/nonproductionTask/vaildStaffNum"))

    def test_personnel_info_keeps_verified_request_contracts(self) -> None:
        basic = self.catalog.get_endpoint("personnel-info.basic").endpoint
        training = self.catalog.get_endpoint("personnel-info.training-records").endpoint
        experience = self.catalog.get_endpoint("personnel-info.training-experiences").endpoint

        self.assertEqual(basic["path"], "/newieb/hrInfo/showEmpInfo")
        self.assertEqual(basic["requestEncoding"], "multipart/form-data")
        self.assertEqual([item["name"] for item in basic["response"]["fields"]], [
            "empDto", "eduList", "workList", "titleList", "relationList",
        ])
        self.assertEqual(training["path"], "/newieb/basics/trainingRecordList")
        self.assertEqual({item["name"] for item in training["parameters"]}, {
            "page", "staffId", "fuzzyQuery", "newMachineId", "trainName",
        })
        self.assertEqual(experience["path"], "/newieb/basics/trainResultList")

    def test_friendly_controls_keep_derived_portal_fields_documented(self) -> None:
        endpoint = self.catalog.get_endpoint("lock-entry.submit").endpoint
        controls = {parameter["name"]: parameter for parameter in endpoint["parameters"]}
        self.assertEqual(controls["lockType"]["optionSource"], "lock-types")
        self.assertEqual(controls["startDt"]["type"], "datetime-local")
        self.assertEqual(controls["lockYearAndMonth"]["type"], "month")
        self.assertEqual(controls["lockStartHourAndMinute"]["type"], "time")
        self.assertTrue(controls["lockDaysNum"]["repeatable"])
        for derived in ("dateSplitFlag", "lockDays", "lockTypeDesc", "chnName", "orgUnitName", "random"):
            self.assertIn(derived, controls)
            self.assertTrue(controls[derived]["fixed"])


if __name__ == "__main__":
    unittest.main()
