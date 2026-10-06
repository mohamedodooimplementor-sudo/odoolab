/**
 * Refresh button and automatic refresh of the views (control panel).
 *
 * The chosen interval is remembered per action and view type in the
 * browser. The automatic refresh never disturbs the user: it waits while the
 * tab is hidden, a dialog is open, a list row is being edited or selected,
 * or a form has unsaved changes.
 */
import { Component, onWillUnmount, useState } from "@odoo/owl";
import { browser } from "@web/core/browser/browser";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { ControlPanel } from "@web/search/control_panel/control_panel";
import { currentConfig } from "./hsd_store";

const STORAGE_PREFIX = "home_screen_designer.refresh:";
export const INTERVALS = [0, 15, 30, 60, 120, 300, 600, 1800]; // seconds

function intervalLabel(seconds) {
    if (!seconds) {
        return _t("Off");
    }
    return seconds < 60 ? _t("%s s", seconds) : _t("%s min", seconds / 60);
}

export class HsdRefresh extends Component {
    static template = "home_screen_designer.Refresh";
    static components = { Dropdown, DropdownItem };
    static props = {};

    setup() {
        this.notification = useService("notification");
        this.intervals = INTERVALS;
        this.intervalLabel = intervalLabel;
        this.state = useState({ interval: this.storedInterval(), busy: false });
        this.schedule();
        onWillUnmount(() => browser.clearTimeout(this.timer));
    }

    // ---------------------------------------------------------- storage ---
    get storageKey() {
        const action = this.env.config?.actionId || "none";
        return `${STORAGE_PREFIX}${action}:${this.env.config?.viewType || "view"}`;
    }

    storedInterval() {
        try {
            const value = parseInt(browser.localStorage.getItem(this.storageKey), 10);
            return INTERVALS.includes(value) ? value : 0;
        } catch {
            return 0;
        }
    }

    setInterval(seconds) {
        this.state.interval = seconds;
        try {
            if (seconds) {
                browser.localStorage.setItem(this.storageKey, String(seconds));
            } else {
                browser.localStorage.removeItem(this.storageKey);
            }
        } catch {
            // no storage: the interval only lasts for this view
        }
        this.schedule();
    }

    // ---------------------------------------------------------- refresh ---
    schedule() {
        browser.clearTimeout(this.timer);
        if (this.state.interval) {
            this.timer = browser.setTimeout(async () => {
                if (this.canAutoRefresh()) {
                    await this.refresh();
                }
                this.schedule();
            }, this.state.interval * 1000);
        }
    }

    get isForm() {
        return this.env.config?.viewType === "form";
    }

    canAutoRefresh() {
        if (document.hidden || document.querySelector(".modal.show, .o_dialog .modal")) {
            return false;
        }
        const root = this.env.model?.root;
        if (!root || this.isForm) {
            return Boolean(this.env.searchModel || this.isForm);
        }
        // Lists: a row being edited or selected stays untouched.
        return !root.editedRecord && !(root.selection && root.selection.length);
    }

    async refresh(manual = false) {
        if (this.state.busy) {
            return;
        }
        this.state.busy = true;
        try {
            if (this.isForm) {
                const root = this.env.model?.root;
                if (!root) {
                    return;
                }
                if (await root.isDirty()) {
                    if (manual) {
                        this.notification.add(
                            _t("Save or discard your changes before refreshing."),
                            { type: "warning" },
                        );
                    }
                    return;
                }
                await this.env.model.load();
            } else if (this.env.searchModel) {
                this.env.searchModel.search();
            }
        } finally {
            this.state.busy = false;
        }
    }

    onClick() {
        this.refresh(true);
        this.schedule(); // the countdown restarts after a manual refresh
    }
}

// Given through the instance (t-component), not the static components: some
// apps subclass the control panel with their own copy of the components.
patch(ControlPanel.prototype, {
    get hsdRefresh() {
        return currentConfig().refresh_button !== false;
    },
    get hsdRefreshComponent() {
        return HsdRefresh;
    },
});
