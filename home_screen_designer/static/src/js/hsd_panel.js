/**
 * Designer panel: a drawer on the right side of the screen, without backdrop,
 * so that every change is previewed live on the home screen behind it.
 */
import { Component, useExternalListener, useRef, useState } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { useSortable } from "@web/core/utils/sortable_owl";
import { displayedScheme, setColorScheme } from "./hsd_color_scheme";
import {
    PRESETS, currentBackground, currentConfig, hsdStore, useHsdStore,
} from "./hsd_store";

// Longest side of the uploaded pictures: enough for a 4K screen once blurred
// by the browser scaling, and keeps the stored file small.
const MAX_SIDE = 2560;
const LIGHT_PRESETS = ["lavender", "peach"];

function sections() {
    const community = hsdStore.mode === "community";
    return [
        {
            id: "appearance",
            title: _t("Appearance"),
            hidden: !hsdStore.ownsColorScheme,
            controls: [{ key: "color_scheme", type: "scheme", label: _t("Theme") }],
        },
        {
            id: "apps",
            title: _t("Apps"),
            controls: [{ key: "app_order", type: "apps" }],
        },
        {
            id: "sidebar",
            title: _t("Bars"),
            controls: [
                { key: "navbar_style", type: "segmented", label: _t("Top bar inside the apps"),
                    choices: [["surface", _t("Blended")], ["color", _t("Colored")]] },
                { key: "refresh_button", type: "switch",
                    label: _t("Refresh button in the views (with automatic refresh)") },
                { key: "sidebar", type: "segmented", label: _t("Apps bar inside the apps"),
                    choices: [
                        ["off", _t("Hidden")], ["icons", _t("Icons")], ["labels", _t("Icons + names")],
                    ] },
            ],
        },
        {
            id: "layout",
            title: _t("Layout"),
            controls: [
                { key: "fit_screen", type: "switch", label: _t("Fit to screen width") },
                { key: "columns", type: "range", min: 3, max: 12, label: _t("Columns"),
                    hidden: (c) => c.fit_screen },
                { key: "spacing", type: "range", min: 0, max: 48, unit: "px", label: _t("Spacing") },
            ],
        },
        {
            id: "icons",
            title: _t("Icons"),
            controls: [
                { key: "icon_size", type: "range", min: 32, max: 128, unit: "px", label: _t("Icon size") },
                { key: "radius", type: "range", min: 0, max: 50, unit: "%", label: _t("Corner radius") },
                { key: "font_size", type: "range", min: 10, max: 20, unit: "px", label: _t("Text size"),
                    hidden: (c) => !c.show_captions },
                { key: "show_captions", type: "switch", label: _t("Show app names") },
                { key: "caption_color", type: "segmented", label: _t("Text color"),
                    hidden: (c) => !c.show_captions,
                    choices: [
                        ["auto", _t("Auto")], ["light", _t("Light")], ["dark", _t("Dark")],
                    ] },
            ],
        },
        {
            id: "background",
            title: _t("Background"),
            controls: [
                { key: "bg_mode", type: "segmented", label: _t("Background"),
                    choices: [
                        ["none", _t("Default")], ["preset", _t("Gradient")], ["image", _t("Picture")],
                    ] },
                { key: "bg_preset", type: "presets", hidden: (c) => c.bg_mode !== "preset" },
                { key: "bg_image", type: "image", hidden: (c) => c.bg_mode !== "image" },
                { key: "bg_opacity", type: "range", min: 0, max: 100, unit: "%",
                    label: _t("Background visibility"), hidden: (c) => c.bg_mode === "none" },
                { key: "bg_tint", type: "segmented", label: _t("Overlay"),
                    hidden: (c) => c.bg_mode === "none",
                    choices: [["dark", _t("Dark")], ["light", _t("Light")]] },
                { key: "bg_blur", type: "range", min: 0, max: 20, unit: "px", label: _t("Blur"),
                    hidden: (c) => c.bg_mode === "none" },
            ],
        },
        {
            id: "effects",
            title: _t("Effects"),
            controls: [
                { key: "glass", type: "switch", label: _t("Glass tiles (glassmorphism)") },
                { key: "glass_blur", type: "range", min: 0, max: 40, unit: "px",
                    label: _t("Glass blur"), hidden: (c) => !c.glass },
                { key: "anim_entrance", type: "switch", label: _t("Entrance animation") },
                { key: "anim_hover", type: "segmented", label: _t("Hover effect"),
                    choices: [
                        ["none", _t("None")], ["lift", _t("Lift")],
                        ["bounce", _t("Bounce")], ["grow", _t("Grow")],
                    ] },
            ],
        },
        {
            id: "header",
            title: _t("Greeting & clock"),
            controls: [
                { key: "greeting", type: "switch", label: _t("Personal greeting") },
                { key: "clock", type: "switch", label: _t("Clock") },
                { key: "seconds", type: "switch", label: _t("Show seconds"),
                    hidden: (c) => !c.clock },
                { key: "show_date", type: "switch", label: _t("Date"),
                    hidden: (c) => !c.clock },
            ],
        },
        {
            id: "home",
            title: _t("Home screen"),
            controls: [
                { key: "search", type: "switch", label: _t("Search bar (apps and menus)") },
                { key: "open_on_start", type: "switch", label: _t("Open the home screen after login"),
                    hidden: () => !community },
            ],
        },
    ].filter((section) => !section.hidden);
}

export class HsdPanel extends Component {
    static template = "home_screen_designer.Panel";
    static props = {};

    setup() {
        this.hsd = useService("home_screen_designer");
        this.notification = useService("notification");
        this.action = useService("action");
        this.store = useHsdStore();
        this.presets = PRESETS;
        this.state = useState({ busy: false, more: false });
        this.appsRef = useRef("apps");
        useSortable({
            ref: this.appsRef,
            elements: ".hsd-app-row",
            handle: ".hsd-app-grip",
            cursor: "grabbing",
            placeholderClasses: ["hsd-app-row-placeholder"],
            onDrop: ({ element, previous }) =>
                this.hsd.moveApp(element.dataset.xmlid, previous?.dataset.xmlid || null),
        });
        useExternalListener(window, "keydown", (ev) => {
            if (ev.key === "Escape" && this.store.panelOpen && !this.state.busy) {
                this.hsd.closePanel();
            }
        });
    }

    get sections() {
        const cfg = this.cfg;
        return sections().map((section) => ({
            ...section,
            controls: section.controls.filter((c) => !c.hidden || !c.hidden(cfg)),
        }));
    }

    get cfg() {
        return currentConfig(this.store);
    }

    get serverState() {
        return this.store.state || {};
    }

    get background() {
        return currentBackground(this.store);
    }

    get statusText() {
        if (this.serverState.personal) {
            return _t("You are using your personal layout.");
        }
        return _t("You are using the layout of %s.", this.serverState.company_name || "");
    }

    // ------------------------------------------------------------- apps ---
    get apps() {
        return this.hsd.orderedApps(this.store).map((app) => {
            const [iconClass, color, background] = (app.webIcon || "").split(",");
            return {
                xmlid: app.xmlid,
                name: app.name,
                hidden: app.hsdHidden,
                image: app.webIconData || (!background ? "/web/static/img/default_icon_app.png" : false),
                iconClass,
                color,
                background,
            };
        });
    }

    toggleApp(app) {
        this.hsd.toggleApp(app.xmlid);
    }

    resetApps() {
        this.hsd.resetApps();
    }

    // ------------------------------------------------------ dark / admin ---
    get colorScheme() {
        return this.store.state?.color_scheme || displayedScheme();
    }

    get schemeChoices() {
        return [["light", _t("Light")], ["dark", _t("Dark")], ["system", _t("System")]];
    }

    setScheme(scheme) {
        if (scheme !== this.colorScheme && !this.state.busy) {
            this.state.busy = true;
            setColorScheme(this.env, scheme); // reloads the page
        }
    }

    openSettings() {
        this.hsd.closePanel();
        this.action.doAction("home_screen_designer.action_hsd_settings");
    }

    presetLabel(preset) {
        return preset.charAt(0).toUpperCase() + preset.slice(1);
    }

    // ---------------------------------------------------------- changes ---
    onRange(control, ev) {
        this.hsd.setDraft(control.key, parseInt(ev.target.value, 10));
    }

    onSwitch(control, ev) {
        this.hsd.setDraft(control.key, ev.target.checked);
    }

    onChoice(control, value) {
        this.hsd.setDraft(control.key, value);
        // Pale gradients read better with a light overlay (dark text).
        if (control.key === "bg_preset") {
            this.hsd.setDraft("bg_tint", LIGHT_PRESETS.includes(value) ? "light" : "dark");
        }
    }

    async onFile(ev) {
        const file = ev.target.files?.[0];
        ev.target.value = "";
        if (!file) {
            return;
        }
        if (!file.type.startsWith("image/")) {
            this.notification.add(_t("Please choose a picture."), { type: "warning" });
            return;
        }
        try {
            this.hsd.setDraftBackground(await this.resize(file));
        } catch {
            this.notification.add(_t("This picture could not be read."), { type: "danger" });
        }
    }

    removeBackground() {
        this.hsd.setDraftBackground(false);
    }

    /** Downscale the picture in the browser and return a JPEG data URL. */
    resize(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const ratio = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.round(img.width * ratio);
                canvas.height = Math.round(img.height * ratio);
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL("image/jpeg", 0.86));
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("unreadable picture"));
            };
            img.src = url;
        });
    }

    // ---------------------------------------------------------- actions ---
    async run(fn, message) {
        if (this.state.busy) {
            return;
        }
        this.state.busy = true;
        try {
            await fn();
            if (message) {
                this.notification.add(message, { type: "success" });
            }
        } finally {
            this.state.busy = false;
            this.state.more = false;
        }
    }

    save() {
        return this.run(() => this.hsd.save("user"), _t("Your home screen has been saved."));
    }

    saveCompany() {
        return this.run(
            () => this.hsd.save("company"),
            _t("This layout is now the default home screen of the company."),
        );
    }

    resetUser() {
        return this.run(() => this.hsd.reset("user"), _t("You now use the company layout."));
    }

    resetCompany() {
        return this.run(
            () => this.hsd.reset("company"),
            _t("The company layout has been reset."),
        );
    }

    cancel() {
        this.hsd.closePanel();
    }
}

/** Background layer of the home screen (shown by the stylesheet only). */
export class HsdBackdrop extends Component {
    static template = "home_screen_designer.Backdrop";
    static props = {};
}

/** Mounts the panel only while it is open. */
export class HsdPanelContainer extends Component {
    static template = "home_screen_designer.PanelContainer";
    static components = { HsdPanel, HsdBackdrop };
    static props = {};

    setup() {
        this.store = useHsdStore();
    }

    get open() {
        return this.store.panelOpen;
    }
}

registry.category("main_components").add("home_screen_designer.Panel", {
    Component: HsdPanelContainer,
});
