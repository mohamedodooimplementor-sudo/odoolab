/**
 * Greeting and clock displayed above the apps.
 *
 * ``HsdHeader`` is used inside the Community home screen; ``HsdNativeHeader``
 * is a main component that shows it over the Enterprise home menu, with a
 * search bar (the Enterprise one is only visible on touch screens).
 */
import { Component, onMounted, onWillUnmount, useEffect, useRef, useState } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { user } from "@web/core/user";
import { useService } from "@web/core/utils/hooks";
import { currentConfig, useHsdStore } from "./hsd_store";

function locale() {
    return (user.lang || "en-US").replace("_", "-");
}

export class HsdHeader extends Component {
    static template = "home_screen_designer.Header";
    static props = {};

    setup() {
        this.store = useHsdStore();
        this.state = useState({ time: "", date: "", greeting: "" });
        this.firstName = (user.name || "").trim().split(/\s+/)[0];
        this.update();
        onMounted(() => {
            this.timer = setInterval(() => this.update(), 1000);
        });
        onWillUnmount(() => clearInterval(this.timer));
    }

    get cfg() {
        return currentConfig(this.store);
    }

    get visible() {
        return this.cfg.greeting || this.cfg.clock;
    }

    update() {
        const now = new Date();
        const cfg = currentConfig();
        let time = "";
        let date = "";
        try {
            time = now.toLocaleTimeString(locale(), {
                hour: "2-digit",
                minute: "2-digit",
                second: cfg.seconds ? "2-digit" : undefined,
            });
            date = now.toLocaleDateString(locale(), {
                weekday: "long",
                day: "numeric",
                month: "long",
            });
        } catch {
            time = now.toTimeString().slice(0, cfg.seconds ? 8 : 5);
            date = now.toDateString();
        }
        const hour = now.getHours();
        let greeting;
        if (hour >= 5 && hour < 12) {
            greeting = _t("Good morning");
        } else if (hour >= 12 && hour < 18) {
            greeting = _t("Good afternoon");
        } else {
            greeting = _t("Good evening");
        }
        // Only touch the state when the display changes: no useless render.
        if (time !== this.state.time) {
            this.state.time = time;
        }
        if (date !== this.state.date) {
            this.state.date = date;
        }
        if (greeting !== this.state.greeting) {
            this.state.greeting = greeting;
        }
    }
}

export class HsdNativeHeader extends Component {
    static template = "home_screen_designer.NativeHeader";
    static components = { HsdHeader };
    static props = {};

    setup() {
        this.store = useHsdStore();
        this.command = useService("command");
        this.rootRef = useRef("root");
        // The search bar replaces the Enterprise one (hidden by the stylesheet).
        useEffect((search) => {
            document.body.classList.toggle("hsd-native-search", search);
            return () => document.body.classList.remove("hsd-native-search");
        }, () => [Boolean(this.visible && this.cfg.search)]);
        // Room left above the apps of the home menu for the header.
        useEffect((el) => {
            const body = document.body;
            if (!el) {
                body.classList.remove("hsd-has-header");
                return;
            }
            // Lay the header over the home menu itself: themes may add a
            // side bar or hide the navbar.
            let watched = null;
            const place = () => {
                const homeMenu = document.querySelector(".o_home_menu");
                if (homeMenu && homeMenu !== watched) {
                    watched = homeMenu;
                    observer.observe(homeMenu); // follows the panel opening
                }
                if (homeMenu) {
                    const rect = homeMenu.getBoundingClientRect();
                    el.style.top = `${rect.top}px`;
                    el.style.left = `${rect.left}px`;
                    el.style.width = `${homeMenu.clientWidth}px`;
                }
                body.style.setProperty("--hsd-header-h", `${el.offsetHeight}px`);
            };
            const observer = new ResizeObserver(place);
            observer.observe(el);
            observer.observe(body);
            // The home menu may be rendered right after the header.
            const frame = requestAnimationFrame(place);
            body.classList.add("hsd-has-header");
            return () => {
                cancelAnimationFrame(frame);
                observer.disconnect();
                body.classList.remove("hsd-has-header");
            };
        }, () => [this.rootRef.el]);
    }

    get cfg() {
        return currentConfig(this.store);
    }

    get visible() {
        const cfg = this.cfg;
        return this.store.mode === "native" && this.store.onHome
            && (cfg.greeting || cfg.clock || cfg.search);
    }

    /** Same behavior as the Enterprise search: the command palette, on the
     * apps and menus ("/"), opened with what was typed. */
    openSearch(text = "") {
        this.command.openMainPalette({ searchValue: `/${text.trim()}` });
    }

    onSearchInput(ev) {
        const text = ev.target.value;
        ev.target.value = "";
        this.openSearch(text);
    }
}

registry.category("main_components").add("home_screen_designer.NativeHeader", {
    Component: HsdNativeHeader,
});
