from odoo import models
from odoo.http import request


class IrHttp(models.AbstractModel):
    _inherit = 'ir.http'

    def session_info(self):
        result = super().session_info()
        # Sent with the session so that the home screen is styled on the very
        # first paint, without waiting for an extra RPC.
        if self.env.user._is_internal():
            result['home_screen_designer'] = \
                self.env['res.users'].hsd_get_state()
        return result

    def color_scheme(self):
        """Light or dark assets of the web client.

        Odoo Community always answers "light"; Enterprise (and some themes)
        have their own switch. The choice made in this module wins when the
        user made one, otherwise the decision is left to them."""
        if self._hsd_native_color_scheme():
            return super().color_scheme()
        user = self.env.user
        if user and not user._is_public():
            scheme = user.sudo().hsd_color_scheme
            if scheme in ('light', 'dark'):
                return scheme
            if scheme == 'system':
                # The browser stores the system preference in this cookie.
                cookie = request and request.httprequest.cookies.get('color_scheme')
                return cookie if cookie in ('light', 'dark') else 'light'
        return super().color_scheme()

    def _hsd_native_color_scheme(self):
        """Enterprise and some themes store their own color scheme on the
        user settings: the switch is theirs, this module stays out of it."""
        return 'color_scheme' in self.env['res.users.settings']._fields
