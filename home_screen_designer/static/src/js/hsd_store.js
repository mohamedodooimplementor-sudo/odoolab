/**
 * Shared state of the Home Screen Designer and application of a layout.
 *
 * A layout is applied as CSS custom properties and classes on <body>: the
 * stylesheet does the rest, for the Enterprise home menu (``.o_home_menu``)
 * and for the Community home screen of this module (``.o_hsd_home``) alike.
 */
import { reactive, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { session } from "@web/session";

// Mirror of models/hsd_config.py (used when the session carries nothing).
export const DEFAULTS = {
    columns: 6,
    fit_screen: false,
    spacing: 16,
    icon_size: 64,
    radius: 22,
    font_size: 13,
    show_captions: true,
    caption_color: "auto",
    bg_mode: "none",
    bg_preset: "aurora",
    bg_opacity: 100,
    bg_tint: "dark",
    bg_blur: 0,
    glass: false,
    glass_blur: 14,
    anim_entrance: true,
    anim_hover: "lift",
    greeting: true,
    clock: true,
    show_date: true,
    seconds: false,
    search: true,
    open_on_start: true,
    app_order: [],
    hidden_apps: [],
    sidebar: "off",
    navbar_style: "surface",
    refresh_button: true,
};

export const PRESETS = [
    "aurora", "sunset", "ocean", "forest", "graphite", "lavender", "peach", "night",
];

export const HOME_ACTION = "home_screen_designer.action_home_screen";

/**
 * - ``state``: what the server sent (see res.users.hsd_get_state);
 * - ``draft``: layout being edited in the panel (live preview), or null;
 * - ``draftBackground``: picture chosen in the panel and not saved yet;
 * - ``mode``: ``"native"`` when a home menu already exists (Enterprise, or a
 *   theme that brings one), ``"community"`` when this module provides it;
 * - ``onHome``: the home screen is currently displayed.
 */
export const hsdStore = reactive({
    state: session.home_screen_designer || null,
    draft: null,
    draftBackground: null,
    panelOpen: false,
    mode: "community", // resolved by the service, once every module is loaded
    onHome: false,
    ownsColorScheme: false, // this module provides the dark mode switch
});

export function detectMode() {
    hsdStore.mode = registry.category("services").contains("home_menu")
        ? "native"
        : "community";
    return hsdStore.mode;
}

/**
 * Store subscribed by the calling component (OWL 2: only the reads made
 * through this object re-render the component when the store changes).
 */
export function useHsdStore() {
    return useState(hsdStore);
}

/**
 * @param {Object} [store] the component's ``useHsdStore()`` (to be
 *     re-rendered on changes); the raw store otherwise
 */
export function currentConfig(store = hsdStore) {
    return store.draft || store.state?.config || DEFAULTS;
}

export function currentBackground(store = hsdStore) {
    if (store.draftBackground !== null) {
        return store.draftBackground; // data URL, or false when removed
    }
    return store.state?.background_url || false;
}

const BODY_CLASSES = [
    "hsd-fit", "hsd-glass", "hsd-anim-in", "hsd-no-captions", "hsd-has-bg",
    "hsd-caption-light", "hsd-caption-dark", "hsd-tint-light", "hsd-tint-dark",
    "hsd-hover-lift", "hsd-hover-bounce", "hsd-hover-grow", "hsd-navbar-surface",
    ...PRESETS.map((p) => `hsd-preset-${p}`),
];

/**
 * Apply the current layout (draft first) to <body>.
 */
export function applyLayout() {
    const cfg = currentConfig();
    const background = cfg.bg_mode === "image" ? currentBackground() : false;
    const hasBg = cfg.bg_mode === "preset" || Boolean(background);
    const body = document.body;
    const style = body.style;

    const icon = cfg.icon_size;
    const tile = icon + 48; // icon + caption breathing room
    style.setProperty("--hsd-cols", cfg.columns);
    style.setProperty("--hsd-gap", `${cfg.spacing}px`);
    style.setProperty("--hsd-icon", `${icon}px`);
    style.setProperty("--hsd-tile", `${tile}px`);
    style.setProperty("--hsd-radius", `${Math.round((icon * cfg.radius) / 100)}px`);
    style.setProperty("--hsd-font", `${cfg.font_size}px`);
    style.setProperty("--hsd-max-w", cfg.fit_screen
        ? "1600px"
        : `${cfg.columns * tile + (cfg.columns - 1) * cfg.spacing + 32}px`);
    style.setProperty("--hsd-bg-opacity", cfg.bg_opacity / 100);
    style.setProperty("--hsd-bg-blur", `${cfg.bg_blur}px`);
    style.setProperty("--hsd-glass-blur", `${cfg.glass_blur}px`);
    if (background) {
        style.setProperty("--hsd-bg-image", `url("${background}")`);
    } else {
        style.removeProperty("--hsd-bg-image");
    }

    let caption = cfg.caption_color;
    if (caption === "auto") {
        caption = hasBg ? (cfg.bg_tint === "dark" ? "light" : "dark") : "";
    }
    const classes = {
        "hsd-fit": cfg.fit_screen,
        "hsd-glass": cfg.glass,
        "hsd-anim-in": cfg.anim_entrance,
        "hsd-no-captions": !cfg.show_captions,
        "hsd-has-bg": hasBg,
        [`hsd-caption-${caption}`]: Boolean(caption),
        [`hsd-tint-${cfg.bg_tint}`]: hasBg,
        [`hsd-hover-${cfg.anim_hover}`]: cfg.anim_hover !== "none",
        [`hsd-preset-${cfg.bg_preset}`]: cfg.bg_mode === "preset",
        "hsd-navbar-surface": cfg.navbar_style !== "color",
    };
    for (const cls of BODY_CLASSES) {
        body.classList.toggle(cls, Boolean(classes[cls]));
    }
    applyNativeAppOrder(cfg);
}

/**
 * Apps in the order chosen by the user (apps unknown to the order keep
 * Odoo's order, after the ordered ones).
 *
 * @param {Object[]} apps objects with an ``xmlid``
 * @param {Object} [options] ``withHidden``: keep the hidden apps (flagged);
 *     ``store``: the component's ``useHsdStore()``
 */
export function orderApps(apps, { withHidden = false, store = hsdStore } = {}) {
    const cfg = currentConfig(store);
    const order = cfg.app_order || [];
    const hidden = new Set(cfg.hidden_apps || []);
    const rank = (app) => {
        const index = order.indexOf(app.xmlid);
        return index === -1 ? order.length + apps.indexOf(app) : index;
    };
    return [...apps]
        .sort((a, b) => rank(a) - rank(b))
        .map((app) => (withHidden ? { ...app, hsdHidden: hidden.has(app.xmlid) } : app))
        .filter((app) => withHidden || !hidden.has(app.xmlid));
}

/**
 * Enterprise home menu: its apps are rendered by Odoo, so the order and the
 * hidden apps are applied with a generated stylesheet (CSS ``order``).
 */
function applyNativeAppOrder(cfg) {
    let style = document.getElementById("hsd-app-order");
    const order = cfg.app_order || [];
    const hidden = cfg.hidden_apps || [];
    if (hsdStore.mode !== "native" || (!order.length && !hidden.length)) {
        style?.remove();
        return;
    }
    if (!style) {
        style = document.createElement("style");
        style.id = "hsd-app-order";
        document.head.appendChild(style);
    }
    const cell = (xmlid) =>
        `.o_home_menu .o_apps > :has(> [data-menu-xmlid="${CSS.escape(xmlid)}"])`;
    const rules = [
        // Apps absent from the order go after the ordered ones.
        `.o_home_menu .o_apps > * { order: ${order.length + 1}; }`,
        ...order.map((xmlid, index) => `${cell(xmlid)} { order: ${index}; }`),
        ...hidden.map((xmlid) => `${cell(xmlid)} { display: none !important; }`),
    ];
    style.textContent = rules.join("\n");
}

/**
 * Mark the home screen as displayed (or not).
 */
export function setOnHome(onHome) {
    hsdStore.onHome = onHome;
    document.body.classList.toggle("hsd-on-home", onHome);
}
