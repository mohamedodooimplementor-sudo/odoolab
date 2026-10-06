import base64
import binascii

from odoo import api, fields, models
from odoo.exceptions import AccessError, UserError

from .hsd_config import COLOR_SCHEMES, DEFAULTS, sanitize

# The browser resizes the pictures before sending them: this limit only
# protects the server against oversized payloads.
MAX_BACKGROUND_BYTES = 6 * 1024 * 1024
IMAGE_SIGNATURES = (
    b'\x89PNG',          # PNG
    b'\xff\xd8\xff',     # JPEG
    b'RIFF',             # WEBP (RIFF container)
    b'GIF8',             # GIF
)


class ResUsers(models.Model):
    _inherit = 'res.users'

    hsd_show_designer = fields.Boolean(
        string="Show Home Screen Designer",
        default=True,
        help="When the users are allowed to personalize their home screen "
             "(Settings > Home Screen), displays the Home Screen Designer icon "
             "in the top bar of this user. Administrators always have it.")
    # Personal layout: empty means "follow the company layout".
    hsd_config = fields.Json(string="Personal Home Screen Layout", copy=False)
    hsd_background = fields.Binary(
        string="Personal Home Screen Background", attachment=True, copy=False)
    hsd_background_rev = fields.Integer(copy=False)
    # Empty: the color scheme is left to Odoo (or to another module).
    hsd_color_scheme = fields.Selection(
        COLOR_SCHEMES, string="Color Scheme", copy=False)

    # ------------------------------------------------------------------
    # State sent to the web client
    # ------------------------------------------------------------------
    @api.model
    def hsd_get_state(self):
        """Effective layout of the current user and everything the designer
        panel needs (personal / company layouts, background URLs, rights)."""
        user = self.env.user.sudo()
        company = self.env.company.sudo()
        can_customize = self._hsd_can_customize()
        company_config = sanitize(company.hsd_config or {})
        user_config = sanitize(user.hsd_config or {})
        # Users who may not personalize get the company layout, even if they
        # saved a personal one while it was allowed.
        personal = bool(user.hsd_config) and can_customize
        config = dict(DEFAULTS, **company_config)
        if personal:
            config.update(user_config)

        user_bg = (
            f'/web/image/res.users/{user.id}/hsd_background'
            f'?unique={user.hsd_background_rev}'
            if user.hsd_background else False)
        company_bg = (
            f'/web/image/res.company/{company.id}/hsd_background'
            f'?unique={company.hsd_background_rev}'
            if company.hsd_background else False)
        # A personal layout uses the personal picture, falling back on the
        # company one so that a user can change the icons only.
        background = (user_bg or company_bg) if personal else company_bg
        return {
            'config': config,
            'defaults': DEFAULTS,
            'personal': personal,
            'user_config': user_config,
            'company_config': company_config,
            'background_url': background or False,
            'user_background_url': user_bg,
            'company_background_url': company_bg,
            'company_name': company.name,
            'can_customize': can_customize,
            'can_set_company': self.env.user._is_system(),
            'color_scheme': user.hsd_color_scheme or False,
        }

    @api.model
    def hsd_set_color_scheme(self, scheme):
        """Store the color scheme of the current user (light, dark or
        following the system). The browser reloads the page afterwards."""
        if scheme not in dict(COLOR_SCHEMES):
            raise UserError(self.env._("Unknown color scheme: %s", scheme))
        self._hsd_target('user').hsd_color_scheme = scheme
        return scheme

    # ------------------------------------------------------------------
    # Saving
    # ------------------------------------------------------------------
    @api.model
    def hsd_save(self, values, scope='user', background=None):
        """Save a layout.

        :param dict values: layout keys (see ``hsd_config.SCHEMA``)
        :param str scope: ``'user'`` (personal layout) or ``'company'``
            (default layout of the current company, administrators only)
        :param background: ``None`` keeps the current picture, ``False``
            removes it, a base64 string replaces it
        :return: the new state (see :meth:`hsd_get_state`)
        """
        if scope == 'user' and not self._hsd_can_customize():
            raise AccessError(self.env._(
                "Your administrator does not allow personal home screens."))
        record = self._hsd_target(scope)
        config = dict(DEFAULTS, **sanitize(values))
        vals = {'hsd_config': config}
        if background is not None:
            vals['hsd_background'] = self._hsd_check_background(background)
            vals['hsd_background_rev'] = record.hsd_background_rev + 1
        record.write(vals)
        return self.hsd_get_state()

    @api.model
    def hsd_reset(self, scope='user'):
        """Forget the personal layout (back to the company layout), or reset
        the company layout to the module defaults."""
        record = self._hsd_target(scope)
        record.write({
            'hsd_config': False,
            'hsd_background': False,
            'hsd_background_rev': record.hsd_background_rev + 1,
        })
        return self.hsd_get_state()

    @api.model
    def _hsd_can_customize(self):
        """Administrators always open the designer; the other users only when
        the administrators allow it (Settings) and did not hide it for them."""
        user = self.env.user
        if user._is_system():
            return True
        allowed = self.env['ir.config_parameter'].sudo().get_param(
            'home_screen_designer.users_can_customize')
        return bool(allowed) and user._is_internal() and bool(user.sudo().hsd_show_designer)

    @api.model
    def _hsd_target(self, scope):
        if scope == 'company':
            if not self.env.user._is_system():
                raise AccessError(self.env._(
                    "Only administrators can change the company home screen."))
            return self.env.company.sudo()
        if scope != 'user':
            raise UserError(self.env._("Unknown layout scope: %s", scope))
        if not self.env.user._is_internal():
            raise AccessError(self.env._(
                "Only internal users have a home screen."))
        # A user only ever writes their own layout fields.
        return self.env.user.sudo()

    @api.model
    def _hsd_check_background(self, background):
        if not background:
            return False
        if isinstance(background, str) and background.startswith('data:'):
            background = background.split(',', 1)[-1]
        try:
            raw = base64.b64decode(background, validate=True)
        except (binascii.Error, ValueError, TypeError):
            raise UserError(self.env._("The background picture is invalid."))
        if len(raw) > MAX_BACKGROUND_BYTES:
            raise UserError(self.env._(
                "The background picture is too large (6 MB maximum)."))
        if not raw.startswith(IMAGE_SIGNATURES):
            raise UserError(self.env._(
                "The background must be a PNG, JPEG, WEBP or GIF picture."))
        # base64 text: what Binary fields accept from RPC (bytes are refused).
        return base64.b64encode(raw).decode()
