/**
 * Community home screen (client action ``home_screen_designer.home``).
 *
 * Odoo Community only has a drop-down list of the apps: this action displays
 * them as a full screen grid of icons, with a search on the apps and menus.
 * The markup reuses the class names of the Enterprise home menu (``o_apps``,
 * ``o_app``, ``o_app_icon``, ``o_caption``) so that one stylesheet styles both.
 */
import { Component, onMounted, onWillUnmount, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { fuzzyLookup } from "@web/core/utils/search";
import { useSortable } from "@web/core/utils/sortable_owl";
import { standardActionServiceProps } from "@web/webclient/actions/action_service";
import { computeAppsAndMenuItems } from "@web/webclient/menus/menu_helpers";
import { HsdHeader } from "./hsd_header";
import { currentConfig, orderApps, setOnHome, useHsdStore } from "./hsd_store";

export class HsdHome extends Component {
    static template = "home_screen_designer.Home";
    static components = { HsdHeader };
    static props = { ...standardActionServiceProps };

    setup() {
        this.menuService = useService("menu");
        this.ui = useService("ui");
        this.hsd = useService("home_screen_designer");
        this.store = useHsdStore();
        this.searchRef = useRef("search");
        this.gridRef = useRef("grid");
        // While the designer panel is open, the icons can be moved by drag
        // and drop (the new order is part of the draft layout).
        useSortable({
            enable: () => this.store.panelOpen && !this.query,
            ref: this.gridRef,
            elements: ".hsd-app-cell",
            cursor: "grabbing",
            placeholderClasses: ["hsd-app-placeholder"],
            onDrop: ({ element, previous }) =>
                this.hsd.moveApp(element.dataset.xmlid, previous?.dataset.xmlid || null),
        });
        this.state = useState({ query: "", focused: 0 });
        onMounted(() => {
            setOnHome(true);
            // No app is "current" on the home screen: the navbar shows no
            // app name nor app menus.
            this.menuService.setCurrentMenu({ appID: null });
            if (this.cfg.search && !this.ui.isSmall) {
                this.searchRef.el?.focus();
            }
        });
        onWillUnmount(() => setOnHome(false));
    }

    get cfg() {
        return currentConfig(this.store);
    }

    get data() {
        const { apps, menuItems } = computeAppsAndMenuItems(this.menuService.getMenuAsTree("root"));
        return { apps: orderApps(apps, { store: this.store }), menuItems };
    }

    get query() {
        return this.state.query.trim();
    }

    get apps() {
        const { apps } = this.data;
        return this.query ? fuzzyLookup(this.query, apps, (a) => a.label) : apps;
    }

    get menuItems() {
        if (!this.query) {
            return [];
        }
        return fuzzyLookup(this.query, this.data.menuItems,
            (m) => `${m.parents} / ${m.label}`).slice(0, 12);
    }

    /** Entrance animation: each icon starts slightly after the previous. */
    appStyle(index) {
        return `--hsd-i: ${Math.min(index, 40)}`;
    }

    onInput(ev) {
        this.state.query = ev.target.value;
        this.state.focused = 0;
    }

    onKeydown(ev) {
        const results = [...this.apps, ...this.menuItems];
        if (ev.key === "Enter" && results.length) {
            ev.preventDefault();
            this.open(results[Math.min(this.state.focused, results.length - 1)]);
        } else if (ev.key === "ArrowDown" || ev.key === "ArrowRight") {
            if (this.query) {
                ev.preventDefault();
                this.state.focused = Math.min(this.state.focused + 1, results.length - 1);
            }
        } else if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") {
            if (this.query) {
                ev.preventDefault();
                this.state.focused = Math.max(this.state.focused - 1, 0);
            }
        } else if (ev.key === "Escape") {
            this.state.query = "";
        }
    }

    isFocused(index) {
        return Boolean(this.query) && index === this.state.focused;
    }

    open(item) {
        this.menuService.selectMenu(item.id);
    }

    onClick(ev, item) {
        // Ctrl / middle click: let the browser open a new tab.
        if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
            return;
        }
        ev.preventDefault();
        if (this.store.panelOpen) {
            return; // arranging the icons, not opening the apps
        }
        this.open(item);
    }
}

registry.category("actions").add("home_screen_designer.home", HsdHome);
