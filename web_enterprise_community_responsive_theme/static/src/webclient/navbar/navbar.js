/** @odoo-module **/

// Copyright Badirra / Mahmoud Salheen — All rights reserved.
// Author: Mahmoud Salheen
// License OPL-1 (Odoo Proprietary License v1.0) — see the LICENSE file.

import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { NavBar } from "@web/webclient/navbar/navbar";
import { useEffect, useState } from "@odoo/owl";

patch(NavBar.prototype, {
    setup() {
        super.setup();
        // Wrapped in useState (not a bare useService) so reading
        // hasHomeMenu — here and in navbar.xml's t-att-class — actually
        // subscribes this component to it and re-renders when it changes.
        this.badirraHomeMenu = useState(useService("badirra_home_menu"));

        // Show the current app's own icon next to its name in the navbar
        // (core Community has no icon there — verified against the real
        // web.NavBar.xml, where .o_menu_brand is a bare text DropdownItem).
        //
        // Done by handing the icon to CSS as a custom property and toggling
        // a marker class, NOT by overriding the template. Two earlier
        // attempts replaced core's .o_menu_brand DropdownItem node via
        // xpath and both white-screened the entire webclient — replacing an
        // OWL *component* node (props/slots and all) is far more fragile
        // than adding an attribute to an element that already exists. The
        // worst case here is simply that no icon shows; the app cannot
        // break, because nothing in the render path is modified.
        useEffect(
            () => {
                const brandEl = this.root.el?.querySelector(".o_menu_brand");
                if (!brandEl) {
                    return;
                }
                const icon = this.currentApp?.webIconData;
                if (icon) {
                    // CSS.escape isn't applicable to a data: URI; wrapping in
                    // quotes keeps any special characters inside it from
                    // terminating the url() token.
                    brandEl.style.setProperty("--o-badirra-app-icon", `url("${icon}")`);
                } else {
                    brandEl.style.removeProperty("--o-badirra-app-icon");
                }
                brandEl.classList.toggle("o_badirra_has_app_icon", Boolean(icon));
            },
            () => [this.currentApp?.webIconData]
        );
    },

    /**
     * Opens the Badirra full-screen app switcher. Called from the button
     * that navbar.xml substitutes in place of the stock apps dropdown.
     */
    onBadirraAppsButtonClick() {
        this.badirraHomeMenu.toggle();
    },
});
