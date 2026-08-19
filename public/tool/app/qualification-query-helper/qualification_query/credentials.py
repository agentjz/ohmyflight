from __future__ import annotations

import re


PORTAL_URL = "https://ieb.csair.com/"
REQUIRED_COOKIE_NAMES = ("iebJSid", "JSESSIONID")


def _extract_cookie_text(source: str) -> str:
    text = str(source or "").strip()
    if not text:
        raise ValueError("请粘贴登录 Cookie")

    quoted_header = re.search(
        r"(?is)(?:-H|--header)\s+\^?(['\"])cookie\s*:\s*(.*?)\^?\1",
        text,
    )
    if quoted_header:
        return quoted_header.group(2).strip()

    quoted_cookie = re.search(r"(?is)(?:-b|--cookie)\s+\^?(['\"])(.*?)\^?\1", text)
    if quoted_cookie:
        return quoted_cookie.group(2).strip()

    header_line = re.search(r"(?im)^\s*cookie\s*:\s*(.+?)\s*$", text)
    if header_line:
        return header_line.group(1).strip().strip("'\"")

    inline_header = re.search(r"(?i)cookie\s*:\s*([^\r\n'\"]+)", text)
    if inline_header:
        return inline_header.group(1).strip()

    if "=" in text and "\n" not in text and "\r" not in text:
        return text.strip("'\"")
    raise ValueError("未在输入中找到 Cookie Header")


def parse_credentials(source: str) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for part in _extract_cookie_text(source).split(";"):
        name, separator, value = part.strip().partition("=")
        if separator and name:
            parsed[name] = value.strip()

    missing = [name for name in REQUIRED_COOKIE_NAMES if not parsed.get(name)]
    if missing:
        raise ValueError(f"登录 Cookie 缺少：{', '.join(missing)}")
    return parsed


def browser_cookies(cookies: dict[str, str]) -> list[dict[str, str]]:
    return [
        {"name": name, "value": value, "url": PORTAL_URL}
        for name, value in cookies.items()
        if name and value
    ]

