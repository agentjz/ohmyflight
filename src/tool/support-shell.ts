const supportThemeButtons = document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]");

function syncSupportThemeButtons(): void {
    if (!window.OhmyflightTheme) return;
    const isDark = window.OhmyflightTheme.getTheme() === "dark";
    const label = isDark ? "切换到白天模式" : "切换到暗夜模式";

    supportThemeButtons.forEach((button) => {
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-pressed", String(isDark));
        button.title = label;
    });
}

supportThemeButtons.forEach((button) => {
    button.addEventListener("click", () => {
        window.OhmyflightTheme?.toggleTheme();
    });
});

window.addEventListener("ohmyflight:themechange", syncSupportThemeButtons);
syncSupportThemeButtons();
