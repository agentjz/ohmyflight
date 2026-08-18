"""Portal labels, routing sets, and result schemas."""

import re

LEAVE_TYPE_MAP = {
    "ALV-年假（公休假）": "ALV",
    "ALV_FD-飞行员公休（订座）": "ALV_FD",
    "RECU_LVE-健康疗养": "RECU_LVE",
    "RECU_LVE_R-康复疗养": "RECU_LVE_R",
    "MAT_FA_LVE-陪产假": "MAT_FA_LVE",
    "MAT_MO_LVE-产假": "MAT_MO_LVE",
    "PREGNANT-孕假": "PREGNANT",
    "PARENT_LVE-探亲假-探父母": "PARENT_LVE",
    "SPOUSE_LVE-探亲假-探配偶": "SPOUSE_LVE",
    "MARR_LVE-婚假": "MARR_LVE",
    "COMP_LVE-丧假": "COMP_LVE",
    "CHILD_LVE-育儿假": "CHILD_LVE",
    "INJURY_LVE-工伤假": "INJURY_LVE",
    "LWOP_LVE-其他（事假）": "LWOP_LVE",
    "UNPAID_LVE-无薪": "UNPAID_LVE",
    "HOUSE_LVE-搬家": "HOUSE_LVE",
    "BREED_LVE-哺乳假": "BREED_LVE",
    "PATERNITY-独生子女护理假": "PATERNITY",
    "BIRC_LVE-计划生育假": "BIRC_LVE",
    "REWARD_LVE-奖励": "REWARD_LVE",
    "PENALTY-停飞": "PENALTY",
    "PRD_LVE-经期假": "PRD_LVE",
    "GRD-地面班": "GRD",
    "GDO-地面休息": "GDO",
    "TRNG1-训练": "TRNG1",
    "BS_STUDY-业务学习": "BS_STUDY",
    "BUSINESS-公务": "BUSINESS",
    "GRD_ONDUTY-地面值班": "GRD_ONDUTY",
    "LG_STUDY-语言学习/考试": "LG_STUDY",
    "MEDL_CHK-体检_临床": "MEDL_CHK",
    "MEDL_PHLE-体检_抽血": "MEDL_PHLE",
    "MEDL_EET-体检_平板": "MEDL_EET",
    "MEDL_PSYC-体检_心理测试": "MEDL_PSYC",
    "MTG-会议": "MTG",
    "MTG_SF-安全讲评会": "MTG_SF",
    "DGET-危险品培训": "DGET",
    "EP-飞行人员应急复训": "EP",
    "CRM-CRM培训": "CRM",
    "T_SIM_INS-模拟机检查": "T_SIM_INS",
    "T_SIM_REC-模拟机复训": "T_SIM_REC",
    "T_SIM_INT-模拟机初始": "T_SIM_INT",
    "T_SIM_UPG-模拟机升级": "T_SIM_UPG",
    "T_SIM_CON-模拟机_转机型": "T_SIM_CON",
    "MAKEUP-补考": "MAKEUP",
    "BS_CONCL-飞行后讲评": "BS_CONCL",
    "BS_CHK-业务检查": "BS_CHK",
    "ADMN-管理任务": "ADMN",
    "SOCIAL-社会活动": "SOCIAL",
    "HANDBOOK-手册": "HANDBOOK",
    "POL_STUDY-政治学习": "POL_STUDY",
    "T/A-部门活动": "T/A",
}

SMART_LEAVE_TYPES = ("RECU_LVE", "ALV_FD")

ALTERNATE_LEAVE_TYPE = {
    "RECU_LVE": "ALV_FD",
    "ALV_FD": "RECU_LVE",
}

LEAVE_CODE_TO_NAME = {v: k for k, v in LEAVE_TYPE_MAP.items()}

LEAVE_CODE_PATTERN = re.compile(
    r'(?<![A-Z0-9_/])('
    + '|'.join(re.escape(code) for code in sorted(LEAVE_CODE_TO_NAME, key=len, reverse=True))
    + r')(?![A-Z0-9_/])'
)

RESULT_HEADERS = [
    "原始序号",
    "片段序号",
    "员工号",
    "姓名",
    "输入锁班类型",
    "输入开始日期",
    "输入结束日期",
    "实际锁班类型",
    "实际开始日期",
    "实际结束日期",
    "计划天数",
    "输入类型可休天数",
    "替代类型可休天数",
    "处理状态",
    "锁班结果",
    "结果姓名",
    "结果锁班类型",
    "结果开始日期",
    "结果结束日期",
    "冲突",
    "备注",
    "员工号匹配",
    "姓名匹配",
    "日期匹配",
    "类型匹配",
    "处理时间",
    "尝试次数",
    "冲突回退",
    "解锁序号",
    "解锁状态",
    "解锁员工号",
    "解锁姓名",
    "解锁开始日期",
    "解锁结束日期",
    "解锁天数",
    "解锁类型",
    "解锁名称",
    "解锁原因",
    "解锁录入人",
    "解锁录入时间",
]

QUOTA_REQUIRED_HEADERS = [
    "休假类型",
    "年份",
    "休假天数",
    "锁班天数",
    "解锁天数",
    "可休天数",
]

EXCEL_HEADER_ALIASES = {
    "员工号": ("员工号", "工号"),
    "姓名": ("姓名",),
    "锁班类型": ("锁班类型", "请假类型"),
    "开始日期": ("开始日期",),
    "结束日期": ("结束日期",),
}

LOCK_QUERY_REQUIRED_HEADERS = [
    "序号",
    "状态",
    "员工号",
    "姓名",
    "开始日期",
    "结束日期",
    "锁班天数",
    "锁班类型",
    "锁班名称",
    "锁班原因",
    "录入人",
    "录入时间",
]
