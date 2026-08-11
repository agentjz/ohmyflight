export const supportThemeButtons = document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]");

export function syncSupportThemeButtons(): void {
    if (!window.WatchdogTheme) return;
    const isDark = window.WatchdogTheme.getTheme() === "dark";
    const label = isDark ? "切换到白天模式" : "切换到暗夜模式";

    supportThemeButtons.forEach((button) => {
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-pressed", String(isDark));
        button.title = label;
    });
}

supportThemeButtons.forEach((button) => {
    button.addEventListener("click", () => {
        window.WatchdogTheme?.toggleTheme();
    });
});

window.addEventListener("watchdog:themechange", syncSupportThemeButtons);
syncSupportThemeButtons();
