from __future__ import annotations

from dataclasses import dataclass

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

from app.core.config import get_settings


@dataclass
class ActionExecutionResult:
    ok: bool
    message: str


class ActionExecutor:
    def execute(self, action_type: str, target: str, value: str | None = None) -> ActionExecutionResult:
        settings = get_settings()
        description = f"{action_type} on '{target}'"
        if value:
            description += f" with value '{value}'"

        if not settings.browser_target_url:
            return ActionExecutionResult(ok=True, message=f"Simulated safe action: {description}.")

        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=settings.playwright_headless)
                page = browser.new_page()
                page.goto(settings.browser_target_url, wait_until="domcontentloaded")

                if action_type == "click":
                    page.get_by_text(target, exact=False).first.click(timeout=2000)
                elif action_type == "type":
                    page.get_by_label(target, exact=False).first.fill(value or "", timeout=2000)
                elif action_type == "select":
                    page.get_by_label(target, exact=False).first.select_option(label=value or "", timeout=2000)
                elif action_type == "scroll":
                    page.mouse.wheel(0, 1000)
                else:
                    browser.close()
                    return ActionExecutionResult(ok=False, message=f"Unsupported action type: {action_type}.")

                browser.close()
            return ActionExecutionResult(ok=True, message=f"Executed Playwright action: {description}.")
        except PlaywrightTimeoutError:
            return ActionExecutionResult(ok=False, message=f"Action failed because the target was ambiguous: {description}.")
        except Exception as exc:
            return ActionExecutionResult(ok=False, message=f"Action failed safely: {exc}")


action_executor = ActionExecutor()
