from __future__ import annotations

import re


REQUIRED_COOKIE_NAMES = ("JSESSIONID", "iebJSid")


def _extract_cookie_text(source: str) -> str:
    text = str(source or "").strip()
    if not text:
        raise ValueError("请粘贴 Cookie Header 或 Copy as cURL")

    quoted_header = re.search(
        r"(?is)(?:-H|--header)\s+\^?(['\"])cookie\s*:\s*(.*?)\^?\1",
        text,
    )
    if quoted_header:
        return quoted_header.group(2).strip()

    quoted_cookie = re.search(
        r"(?is)(?:-b|--cookie)\s+\^?(['\"])(.*?)\^?\1",
        text,
    )
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
    cookie_text = _extract_cookie_text(source)
    cookies: dict[str, str] = {}
    for part in cookie_text.split(";"):
        name, separator, value = part.strip().partition("=")
        if separator and name in REQUIRED_COOKIE_NAMES:
            cookies[name] = value.strip()
    missing = [name for name in REQUIRED_COOKIE_NAMES if not cookies.get(name)]
    if missing:
        raise ValueError(f"登录凭据缺少 Cookie：{', '.join(missing)}")
    return cookies


def format_credentials(cookies: dict[str, str]) -> str:
    return "; ".join(
        f"{name}={cookies[name]}"
        for name in REQUIRED_COOKIE_NAMES
        if cookies.get(name)
    )


def credential_summary(cookies: dict[str, str]) -> dict[str, object]:
    names = [name for name in REQUIRED_COOKIE_NAMES if cookies.get(name)]
    return {"ready": len(names) == len(REQUIRED_COOKIE_NAMES), "cookieNames": names, "cookieCount": len(names)}
