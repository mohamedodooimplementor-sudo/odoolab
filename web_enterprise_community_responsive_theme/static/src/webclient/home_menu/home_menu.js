/** @odoo-module **/

// Copyright Badirra / Mahmoud Salheen — All rights reserved.
// Author: Mahmoud Salheen
// License OPL-1 (Odoo Proprietary License v1.0) — see the LICENSE file.

import { useService } from "@web/core/utils/hooks";
import { useSortable } from "@web/core/utils/sortable_owl";
import { browser } from "@web/core/browser/browser";
import { Component, useState, useRef, onMounted, onWillUnmount } from "@odoo/owl";

const ORDER_STORAGE_KEY = "badirra_homemenu_order";

/**
 * BadirraHomeMenu — full-screen grid app switcher.
 *
 * Mounted by the "badirra_home_menu" action (see home_menu_service.js) as a
 * real controller in the action stack, the same way Odoo Enterprise's own
 * home menu works: opening it is a normal navigation, and closing it is a
 * normal "go back to the previous breadcrumb" restore.
 *
 * App tiles are drag-reorderable (matching ica_web_responsive's home menu),
 * with the order kept in localStorage rather than a server-side user
 * setting: persisting it server-side would need a new field on
 * res.users.settings, which lives in the "mail" module — adding that as a
 * hard dependency just for this would be a heavy ask for a free theme.
 * Trade-off: the custom order is per-browser, not synced across devices.
 */
export class BadirraHomeMenu extends Component {
    static template = "web_enterprise_community_responsive_theme.HomeMenu";
    static props = {};

    setup() {
        this.menuService = useService("menu");
        this.homeMenu = useService("badirra_home_menu");
        this.searchRef = useRef("search");
        this.gridRef = useRef("grid");
        this.state = useState({ query: "", order: this.loadOrder() });

        useSortable({
            enable: () => !this.state.query.trim(),
            ref: this.gridRef,
            elements: ".o_badirra_app_icon",
            cursor: "grabbing",
            delay: 150,
            tolerance: 10,
            onDrop: ({ element, previous }) => this.onAppDrop(element, previous),
        });

        this.onKeydown = this.onKeydown.bind(this);
        onMounted(() => {
            document.addEventListener("keydown", this.onKeydown);
            this.searchRef.el?.focus();
        });
        onWillUnmount(() => document.removeEventListener("keydown", this.onKeydown));
    }

    get apps() {
        const apps = this.menuService.getApps();
        const query = this.state.query.trim().toLowerCase();
        if (query) {
            return apps
                .filter((app) => app.name.toLowerCase().includes(query))
                .sort((a, b) => a.name.localeCompare(b.name));
        }
        return this.applyOrder(apps);
    }

    appKey(app) {
        return app.xmlid || String(app.id);
    }

    loadOrder() {
        try {
            const stored = JSON.parse(browser.localStorage.getItem(ORDER_STORAGE_KEY) || "[]");
            return Array.isArray(stored) ? stored : [];
        } catch {
            return [];
        }
    }

    saveOrder(order) {
        this.state.order = order;
        browser.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
    }

    // Apps the user has never manually reordered still default to
    // alphabetical; any app not (yet) present in a saved order — e.g. one
    // just installed — is appended alphabetically after the ordered ones
    // rather than dropped or jumbled in.
    applyOrder(apps) {
        if (!this.state.order.length) {
            return [...apps].sort((a, b) => a.name.localeCompare(b.name));
        }
        const byKey = new Map(apps.map((app) => [this.appKey(app), app]));
        const ordered = [];
        for (const key of this.state.order) {
            const app = byKey.get(key);
            if (app) {
                ordered.push(app);
                byKey.delete(key);
            }
        }
        const rest = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
        return [...ordered, ...rest];
    }

    onAppDrop(element, previous) {
        const order = this.apps.map((app) => this.appKey(app));
        const draggedKey = element.dataset.appKey;
        const draggedIndex = order.indexOf(draggedKey);
        if (draggedIndex === -1) {
            return;
        }
        order.splice(draggedIndex, 1);
        if (previous) {
            const previousIndex = order.indexOf(previous.dataset.appKey);
            order.splice(previousIndex + 1, 0, draggedKey);
        } else {
            order.unshift(draggedKey);
        }
        this.saveOrder(order);
    }

    onAppClick(app) {
        this.menuService.selectMenu(app);
    }

    onKeydown(ev) {
        if (ev.key === "Escape") {
            this.homeMenu.close();
        }
    }
}
