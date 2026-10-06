/**
 * Community only: the apps button of the navbar and the default landing
 * page open the home screen of this module. With Enterprise (or any module
 * providing a ``home_menu`` service) nothing is changed here.
 */
import { patch } from "@web/core/utils/patch";
import { NavBar } from "@web/webclient/navbar/navbar";
import { WebClient } from "@web/webclient/webclient";
import { HOME_ACTION, currentConfig, hsdStore, useHsdStore } from "./hsd_store";

patch(NavBar.prototype, {
    setup() {
        super.setup(...arguments);
        this.hsdStore = useHsdStore();
        this.hsdCommunityHome = hsdStore.mode === "community";
    },

    hsdOpenHome() {
        this.actionService.doAction(HOME_ACTION, { clearBreadcrumbs: true });
    },

    get hsdOnHome() {
        return this.hsdStore.onHome;
    },
});

patch(WebClient.prototype, {
    _loadDefaultApp() {
        if (hsdStore.mode === "community" && hsdStore.state && currentConfig().open_on_start) {
            return this.actionService.doAction(HOME_ACTION, { clearBreadcrumbs: true });
        }
        return super._loadDefaultApp(...arguments);
    },
});
