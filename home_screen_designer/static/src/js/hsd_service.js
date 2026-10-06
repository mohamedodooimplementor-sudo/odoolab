/**
 * ``home_screen_designer`` service: applies the layout as soon as the web
 * client starts, follows the display of the home screen and saves layouts.
 */
import { registry } from "@web/core/registry";
import {
    HOME_ACTION, applyLayout, currentConfig, detectMode, hsdStore, orderApps, setOnHome,
} from "./hsd_store";

export const hsdService = {
    dependencies: ["action", "orm", "notification", "menu"],
    start(env, { action, orm }) {
        detectMode();
        applyLayout();

        if (hsdStore.mode === "native") {
            // The Enterprise home menu flags <body> while it is displayed.
            const sync = () => {
                const onHome = document.body.classList.contains("o_home_menu_background");
                if (onHome !== hsdStore.onHome) {
                    setOnHome(onHome);
                }
            };
            new MutationObserver(sync).observe(document.body, {
                attributes: true,
                attributeFilter: ["class"],
            });
            sync();
        }

        function setPanelOpen(open) {
            hsdStore.panelOpen = open;
            document.body.classList.toggle("hsd-panel-open", open);
        }

        function setState(state) {
            hsdStore.state = state;
            hsdStore.draft = null;
            hsdStore.draftBackground = null;
            applyLayout();
        }

        return {
            /** Display the home screen (native or Community). */
            async openHome() {
                if (hsdStore.mode === "native") {
                    const homeMenu = env.services.home_menu;
                    if (!homeMenu.hasHomeMenu) {
                        await homeMenu.toggle(true);
                    }
                } else if (!hsdStore.onHome) {
                    await action.doAction(HOME_ACTION, { clearBreadcrumbs: true });
                }
            },

            /** Open the designer panel on a copy of the current layout. */
            async openPanel() {
                hsdStore.draft = { ...currentConfig() };
                hsdStore.draftBackground = null;
                setPanelOpen(true);
                await this.openHome();
            },

            /** Close the panel, dropping the unsaved changes. */
            closePanel() {
                setPanelOpen(false);
                hsdStore.draft = null;
                hsdStore.draftBackground = null;
                applyLayout();
            },

            /** Change one key of the draft and preview it at once. */
            setDraft(key, value) {
                hsdStore.draft = { ...currentConfig(), [key]: value };
                applyLayout();
            },

            /** Preview a picture (data URL), or ``false`` to remove it. */
            setDraftBackground(dataUrl) {
                hsdStore.draftBackground = dataUrl;
                applyLayout();
            },

            /** All the apps of the user, in the current order (draft). */
            orderedApps(store = hsdStore) {
                const apps = env.services.menu.getApps().filter((app) => app.xmlid);
                return orderApps(apps, { withHidden: true, store });
            },

            /** Move an app right after another one (null: first). */
            moveApp(xmlid, afterXmlid) {
                if (!xmlid) {
                    return;
                }
                const order = this.orderedApps().map((app) => app.xmlid)
                    .filter((x) => x !== xmlid);
                const index = afterXmlid ? order.indexOf(afterXmlid) + 1 : 0;
                order.splice(index, 0, xmlid);
                this.setDraft("app_order", order);
            },

            /** Show / hide an app on the home screen and the side bar. */
            toggleApp(xmlid) {
                const hidden = new Set(currentConfig().hidden_apps || []);
                if (hidden.has(xmlid)) {
                    hidden.delete(xmlid);
                } else {
                    hidden.add(xmlid);
                }
                this.setDraft("hidden_apps", [...hidden]);
            },

            /** Odoo's order and every app visible again. */
            resetApps() {
                hsdStore.draft = { ...currentConfig(), app_order: [], hidden_apps: [] };
                applyLayout();
            },

            /** Save the draft for the user or as the company layout. */
            async save(scope = "user") {
                const background = hsdStore.draftBackground === null
                    ? null
                    : hsdStore.draftBackground || false;
                const state = await orm.call("res.users", "hsd_save", [], {
                    values: currentConfig(),
                    scope,
                    background,
                });
                setState(state);
                setPanelOpen(false);
            },

            /** Forget the personal layout / reset the company layout. */
            async reset(scope = "user") {
                const state = await orm.call("res.users", "hsd_reset", [], { scope });
                setState(state);
                hsdStore.draft = { ...state.config };
                applyLayout();
            },
        };
    },
};

registry.category("services").add("home_screen_designer", hsdService);
