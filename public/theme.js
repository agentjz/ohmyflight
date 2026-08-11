(function () {
    "use strict";

    var storageKey = "watchdog.theme";
    var defaultTheme = document.documentElement.dataset.defaultTheme === "dark" ? "dark" : "light";
    function normalizeTheme(value) {
        return value === "dark" || value === "light" ? value : defaultTheme;
    }

    function readStoredTheme() {
        try {
            return normalizeTheme(window.localStorage.getItem(storageKey));
        } catch (error) {
            return defaultTheme;
        }
    }

    function storeTheme(theme) {
        try {
            window.localStorage.setItem(storageKey, theme);
        } catch (error) {
            return;
        }
    }

    function applyTheme(theme, shouldStore) {
        var nextTheme = normalizeTheme(theme);
        var bootstrapTheme = nextTheme;
        var root = document.documentElement;

        root.dataset.theme = nextTheme;
        root.dataset.bsTheme = bootstrapTheme;
        root.style.colorScheme = bootstrapTheme;

        if (document.body) {
            document.body.dataset.theme = nextTheme;
        }

        if (shouldStore) {
            storeTheme(nextTheme);
        }

        window.dispatchEvent(new CustomEvent("watchdog:themechange", {
            detail: { theme: nextTheme }
        }));

        return nextTheme;
    }

    function getTheme() {
        return normalizeTheme(document.documentElement.dataset.theme || readStoredTheme());
    }

    function setTheme(theme) {
        return applyTheme(theme, true);
    }

    function toggleTheme() {
        return setTheme(getTheme() === "dark" ? "light" : "dark");
    }

    window.WatchdogTheme = {
        getTheme: getTheme,
        setTheme: setTheme,
        toggleTheme: toggleTheme,
        storageKey: storageKey
    };

    applyTheme(readStoredTheme(), false);

    document.addEventListener("DOMContentLoaded", function () {
        applyTheme(getTheme(), false);
    });
}());
