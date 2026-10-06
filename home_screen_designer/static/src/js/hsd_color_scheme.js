/**
 * Dark mode switch.
 *
 * Odoo Community ships the dark styles (``web.assets_web_dark``) but no way
 * to choose them; Enterprise (and some themes) have their own switch. This
 * module only adds its switch when no other one exists.
 */
import { browser } from "@web/core/browser/browser";
import { cookie } from "@web/core/browser/cookie";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { hsdStore } from "./hsd_store";

const RELOAD_FLAG = "home_screen_designer.scheme_synced";

export function hasNativeColorScheme() {
    return registry.category("services").contains("color_scheme")
        || registry.category("user_menuitems").contains("color_scheme.switch");
}

function systemScheme() {
    return browser.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Scheme currently displayed: the stylesheet the server served. */
export function displayedScheme() {
    return document.querySelector('link[href*="web.assets_web_dark"]') ? "dark" : "light";
}

/** Store the user's choice, then reload with the matching styles. */
export async function setColorScheme(env, scheme) {
    await env.services.orm.call("res.users", "hsd_set_color_scheme", [scheme]);
    if (hsdStore.state) {
        hsdStore.state.color_scheme = scheme;
    }
    cookie.set("color_scheme", scheme === "system" ? systemScheme() : scheme);
    browser.location.reload();
}

function switchItem(env) {
    const dark = displayedScheme() === "dark";
    return {
        type: "item",
        id: "hsd_color_scheme",
        description: dark ? _t("Light mode") : _t("Dark mode"),
        callback: () => setColorScheme(env, dark ? "light" : "dark"),
        sequence: 45,
    };
}

export const hsdColorSchemeService = {
    dependencies: ["orm"],
    start(env) {
        const owned = !hasNativeColorScheme();
        hsdStore.ownsColorScheme = owned;
        if (!owned) {
            return;
        }
        registry.category("user_menuitems").add("home_screen_designer.color_scheme", switchItem);
        // "Follow the system": the server reads the cookie, so it must match
        // the system preference; reload once if it does not.
        if (hsdStore.state?.color_scheme === "system") {
            const wanted = systemScheme();
            if (displayedScheme() !== wanted) {
                cookie.set("color_scheme", wanted);
                let alreadyReloaded = false;
                try {
                    alreadyReloaded = browser.sessionStorage.getItem(RELOAD_FLAG) === wanted;
                    browser.sessionStorage.setItem(RELOAD_FLAG, wanted);
                } catch {
                    alreadyReloaded = true; // no storage: never loop
                }
                if (!alreadyReloaded) {
                    browser.location.reload();
                }
            }
        }
    },
};

registry.category("services").add("home_screen_designer_color_scheme", hsdColorSchemeService);
