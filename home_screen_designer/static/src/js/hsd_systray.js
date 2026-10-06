/**
 * Top bar button opening the designer panel.
 */
import { Component } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { hsdStore, useHsdStore } from "./hsd_store";

export class HsdSystray extends Component {
    static template = "home_screen_designer.Systray";
    static props = {};

    setup() {
        this.hsd = useService("home_screen_designer");
        this.store = useHsdStore();
    }

    get active() {
        return this.store.panelOpen;
    }

    onClick() {
        if (this.store.panelOpen) {
            this.hsd.closePanel();
        } else {
            this.hsd.openPanel();
        }
    }
}

registry.category("systray").add("home_screen_designer", {
    Component: HsdSystray,
    isDisplayed: () => Boolean(hsdStore.state?.can_customize),
}, { sequence: 40 });
