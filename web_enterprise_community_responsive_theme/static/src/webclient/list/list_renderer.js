/** @odoo-module **/

// Copyright Badirra / Mahmoud Salheen — All rights reserved.
// Author: Mahmoud Salheen
// License OPL-1 (Odoo Proprietary License v1.0) — see the LICENSE file.

import { patch } from "@web/core/utils/patch";
import { useState } from "@odoo/owl";
import { browser } from "@web/core/browser/browser";
import { _t } from "@web/core/l10n/translation";
import { ListRenderer } from "@web/views/list/list_renderer";

const STORAGE_KEY = "badirra_list_density";

/**
 * Adds an optional, desktop-only "compact density" toggle to every list
 * view, matching the denser row height Enterprise users are used to.
 * The preference is purely a local, per-browser display setting (persisted
 * to localStorage) — it never touches the record data or server state.
 */
patch(ListRenderer.prototype, {
    setup() {
        super.setup();
        this.badirraState = useState({
            dense: browser.localStorage.getItem(STORAGE_KEY) === "1",
        });
    },

    get badirraDensityLabel() {
        return this.badirraState.dense ? _t("Comfortable") : _t("Compact");
    },

    onBadirraToggleDensity() {
        this.badirraState.dense = !this.badirraState.dense;
        browser.localStorage.setItem(STORAGE_KEY, this.badirraState.dense ? "1" : "0");
    },
});
