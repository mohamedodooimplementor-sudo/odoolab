/**
 * Side bar of apps, displayed inside the apps (not on the home screen), to
 * jump from an app to another in one click.
 */
import { Component, useEffect, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useBus, useService } from "@web/core/utils/hooks";
import { currentConfig, orderApps, useHsdStore } from "./hsd_store";

export class HsdSidebar extends Component {
    static template = "home_screen_designer.Sidebar";
    static props = {};

    setup() {
        this.menuService = useService("menu");
        this.ui = useState(useService("ui"));
        this.store = useHsdStore();
        this.rootRef = useRef("root");
        // The menu service is not reactive: follow the current app.
        useBus(this.env.bus, "MENUS:APP-CHANGED", () => this.render());
        // The bar starts under the navbar, and the apps make room for it.
        useEffect((el) => {
            const body = document.body;
            if (!el) {
                body.classList.remove("hsd-sidebar-on");
                return;
            }
            // A theme may already have its own bar on the left: start where
            // the content starts (measured before shifting it).
            const actionManager = document.querySelector(".o_action_manager");
            if (actionManager && !body.classList.contains("hsd-sidebar-on")) {
                const left = Math.max(actionManager.getBoundingClientRect().left, 0);
                const margin = parseFloat(getComputedStyle(actionManager).marginLeft) || 0;
                body.style.setProperty("--hsd-sidebar-left", `${left}px`);
                body.style.setProperty("--hsd-content-margin", `${margin}px`);
            }
            const place = () => {
                // Top of the content: under the navbar, or under the bar a
                // theme puts in its place.
                const content = document.querySelector(".o_action_manager");
                const navbar = document.querySelector(".o_main_navbar");
                const top = content
                    ? content.getBoundingClientRect().top
                        + (parseFloat(getComputedStyle(content).paddingTop) || 0)
                    : navbar?.getBoundingClientRect().bottom || 0;
                el.style.top = `${Math.max(top, 0)}px`;
                body.style.setProperty("--hsd-sidebar-w", `${el.offsetWidth}px`);
            };
            const observer = new ResizeObserver(place);
            observer.observe(el);
            observer.observe(body);
            place();
            body.classList.add("hsd-sidebar-on");
            return () => {
                observer.disconnect();
                body.classList.remove("hsd-sidebar-on");
            };
        }, () => [this.rootRef.el]);
    }

    get mode() {
        return currentConfig(this.store).sidebar;
    }

    get visible() {
        return this.mode !== "off" && !this.store.onHome && !this.ui.isSmall;
    }

    get apps() {
        const current = this.menuService.getCurrentApp();
        const apps = this.menuService.getApps().filter((app) => app.xmlid);
        return orderApps(apps, { store: this.store }).map((app) => {
            const [iconClass, color, background] = (app.webIcon || "").split(",");
            return {
                id: app.id,
                xmlid: app.xmlid,
                name: app.name,
                active: current && current.id === app.id,
                href: `/odoo/${app.actionPath || "action-" + app.actionID}`,
                image: app.webIconData || (!background ? "/web/static/img/default_icon_app.png" : false),
                iconClass,
                color,
                background,
            };
        });
    }

    onClick(ev, app) {
        if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
            return; // new tab
        }
        ev.preventDefault();
        this.menuService.selectMenu(app.id);
    }
}

registry.category("main_components").add("home_screen_designer.Sidebar", {
    Component: HsdSidebar,
});
