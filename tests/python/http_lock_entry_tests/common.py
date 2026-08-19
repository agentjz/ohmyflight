from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
APP_DIR = ROOT / "public" / "tool" / "app" / "http-lock-entry-helper"
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))


ENTRY_HTML = """
<div id="showNonproductionTaskImportPage">
  <form id="nonproductionTaskImportForm">
    <select id="lockType" name="lockType">
      <option value=""></option>
      <option value="BS_STUDY" class="0" id="0">【BS_STUDY】业务学习(占值勤期类别)</option>
      <option value="GDO" class="0" id="1">【GDO】地面休息</option>
      <option value="RECU_LVE" class="1" id="1">【RECU_LVE】健康疗养</option>
      <option value="ALV_FD" class="0" id="1">【ALV_FD】飞行员公休（订座）</option>
    </select>
  </form>
</div>
<script>
  $("#lockReasonTxt").val("测试操作员" + "(" + "900000" + "):" + lockTypeDesc);
</script>
"""


SUCCESS_HTML = """
<div id="showNonproductionTaskImportResultPage1">
  <table><thead><tr>
    <th>锁班状态</th><th>员工号</th><th>姓名</th><th>部门</th><th>开始日期</th>
    <th>结束日期</th><th>锁班天数</th><th>锁班类型</th><th>锁班原因</th>
  </tr></thead>
  <tbody class="list"><tr>
    <td><input type="checkbox" value="record-submit">待审批</td><td>900001</td><td>测试甲</td><td>测试部门</td>
    <td>2026-10-08 08:17:00</td><td>2026-10-08 18:43:00</td><td>1</td>
    <td>业务学习(占值勤期类别)</td><td>批量测试</td>
  </tr></tbody></table>
</div>
<div id="showNonproductionTaskImportResultPage2">
  <table><thead><tr><th>锁班结果</th></tr></thead>
  <tbody class="list"><tr><td>没有相关信息</td></tr></tbody></table>
</div>
"""

CONFLICT_HTML = """
<div id="showNonproductionTaskImportResultPage1">
  <table><thead><tr><th>锁班状态</th></tr></thead>
  <tbody class="list"><tr><td>没有相关信息</td></tr></tbody></table>
</div>
<div id="showNonproductionTaskImportResultPage2">
  <table><thead><tr>
    <th>锁班结果</th><th>员工号</th><th>姓名</th><th>开始日期</th><th>结束日期</th>
    <th>锁班类型</th><th>锁班原因</th><th>冲突说明</th>
  </tr></thead>
  <tbody class="list"><tr>
    <td>冲突</td><td>900001</td><td>测试甲</td><td>2026-10-08 08:17:00</td>
    <td>2026-10-08 18:43:00</td><td>业务学习(占值勤期类别)</td>
    <td>批量测试</td><td>与既有任务冲突</td>
  </tr></tbody></table>
</div>
"""
