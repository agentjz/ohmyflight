"""Playwright browser startup, login, and portal navigation."""

from dataclasses import dataclass

from playwright.sync_api import sync_playwright

from .common import c_err, c_hint, c_info, c_ok, c_warn


@dataclass
class PortalSession:
    playwright: object
    browser: object
    context: object
    page: object

    def close(self) -> None:
        self.browser.close()
        self.playwright.stop()


def start_portal_session(
    browser_path: str | None,
    default_timeout: int,
    login_timeout: int | None = None,
) -> PortalSession:
    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(headless=False, executable_path=browser_path)
    context = browser.new_context()
    context.set_default_timeout(default_timeout)
    page = context.new_page()

    try:
        page.goto("https://ieb.csair.com/login")
        page.wait_for_load_state("networkidle")
        page.locator("#scanLogin").wait_for()
        page.locator("#scanLogin").click()
        print(c_info("请扫码登录..."))
        if login_timeout is None:
            page.wait_for_url("**/index/**")
        else:
            page.wait_for_url("**/index/**", timeout=login_timeout)
        page.wait_for_load_state("networkidle")
        print(c_ok("登录成功"))
    except Exception as error:
        print(c_err(f"自动登录失败: {error}"))
        print(c_warn("请手动完成登录"))
        input(c_hint("登录完成后按回车继续..."))

    try:
        print(c_info("正在进入非生产任务录入页面..."))
        page.goto("https://ieb.csair.com/index/index")
        page.wait_for_load_state("networkidle")
        page.get_by_text("运行管理").nth(1).wait_for()
        page.get_by_text("运行管理").nth(1).click()
        page.get_by_role("link", name="非生产任务").wait_for()
        page.get_by_role("link", name="非生产任务").click()
        page.get_by_role("link", name="非生产任务录入").wait_for()
        page.get_by_role("link", name="非生产任务录入").click()
        page.locator("#mainContent").wait_for()
        page.locator("#mainContent").click()
        page.wait_for_load_state("networkidle")
        print(c_ok("已进入非生产任务录入页面"))
    except Exception as error:
        print(c_err(f"自动导航失败: {error}"))
        print(c_warn("请手动进入非生产任务录入页面"))
        input(c_hint("准备好后按回车继续..."))

    return PortalSession(playwright, browser, context, page)
