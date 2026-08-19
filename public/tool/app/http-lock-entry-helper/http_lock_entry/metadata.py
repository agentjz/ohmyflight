"""Parse dynamic lock types and the authenticated operator reason template."""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from .models import LockTypeMetadata, PortalMetadata


def normalize_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def parse_default_reason_prefix(html: str) -> str:
    expression_match = re.search(
        r"(?is)lockReasonTxt[^\n;]*?\.val\((?P<expression>[^\n;]*?lockTypeDesc[^\n;]*?)\)",
        html,
    )
    if not expression_match:
        return ""
    expression = expression_match.group("expression").split("lockTypeDesc", 1)[0]
    fragments = re.findall(r"(['\"])(.*?)\1", expression)
    return "".join(fragment for _quote, fragment in fragments)


def parse_portal_metadata(html: str) -> PortalMetadata:
    soup = BeautifulSoup(html, "html.parser")
    select = soup.select_one("#showNonproductionTaskImportPage #lockType") or soup.select_one("#lockType")
    if select is None:
        raise ValueError("录入页缺少锁班类型列表")

    lock_types: dict[str, LockTypeMetadata] = {}
    for option in select.select("option[value]"):
        code = normalize_text(option.get("value"))
        if not code:
            continue
        label = normalize_text(option.get_text(" ", strip=True))
        description = label.split("】", 1)[-1] if "】" in label else label
        class_value = option.get("class", [])
        limit_flag = normalize_text(" ".join(class_value) if isinstance(class_value, list) else class_value)
        lock_types[code] = LockTypeMetadata(
            code=code,
            label=label,
            description=description,
            limit_flag=limit_flag,
            date_split_flag=normalize_text(option.get("id")),
        )
    if not lock_types:
        raise ValueError("录入页没有可用锁班类型")
    return PortalMetadata(
        lock_types=lock_types,
        default_reason_prefix=parse_default_reason_prefix(html),
    )


def normalize_lock_type(value: object, metadata: PortalMetadata) -> str:
    text = normalize_text(value)
    if not text:
        return ""
    upper = text.upper()
    if upper in metadata.lock_types:
        return upper

    bracketed = re.search(r"【([^】]+)】", text)
    if bracketed and bracketed.group(1).upper() in metadata.lock_types:
        return bracketed.group(1).upper()

    for code in sorted(metadata.lock_types, key=len, reverse=True):
        if re.search(rf"(?<![A-Z0-9_/]){re.escape(code)}(?![A-Z0-9_/])", upper):
            return code

    compact = normalize_text(text.replace("(占值勤期类别)", ""))
    matches = []
    for code, item in metadata.lock_types.items():
        description = normalize_text(item.description.replace("(占值勤期类别)", ""))
        if compact == description or (compact and compact in description):
            matches.append(code)
    return matches[0] if len(matches) == 1 else ""
