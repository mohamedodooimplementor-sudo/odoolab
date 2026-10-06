import base64
import re

from odoo import api, fields, models
from odoo.exceptions import UserError
from odoo.tools.image import image_process

from .hsd_config import DARK_THEME_COLORS, THEME_COLORS

PARAM_PREFIX = 'home_screen_designer.'
COLOR_RE = re.compile(r'^#[0-9a-fA-F]{6}$')

# The SCSS files of the module are replaced by attachments holding the
# variables (the same mechanism as Odoo's own customizable assets).
COLOR_FILES = {
    'light': ('/home_screen_designer/static/src/scss/hsd_colors.scss',
              'web.assets_web'),
    'dark': ('/home_screen_designer/static/src/scss/hsd_colors_dark.scss',
             'web.assets_web_dark'),
}
CUSTOM_PREFIX = '/_custom'

PWA_ICON_NAME = 'home_screen_designer_pwa_icon'
PWA_ICON_MODEL = 'res.config.settings'
PWA_ICON_SIDE = 512


def raw_bytes(attachment):
    """Content of an attachment as bytes (empty bytes when there is none)."""
    return bytes(attachment.raw or b'') if attachment else b''


def _color_field(key, dark=False):
    name = f'hsd_color_{key}' + ('_dark' if dark else '')
    return name, PARAM_PREFIX + name.removeprefix('hsd_')


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    # Off: only the administrators open the designer, everyone else gets the
    # company layout.
    hsd_users_can_customize = fields.Boolean(
        "Users Can Personalize Their Home Screen",
        config_parameter='home_screen_designer.users_can_customize')

    # Theme colors (empty: Odoo's color)
    hsd_color_brand = fields.Char("Brand Color", config_parameter='home_screen_designer.color_brand')
    hsd_color_primary = fields.Char("Primary Color", config_parameter='home_screen_designer.color_primary')
    hsd_color_navbar = fields.Char("Top Bar Color", config_parameter='home_screen_designer.color_navbar')
    hsd_color_success = fields.Char("Success Color", config_parameter='home_screen_designer.color_success')
    hsd_color_info = fields.Char("Info Color", config_parameter='home_screen_designer.color_info')
    hsd_color_warning = fields.Char("Warning Color", config_parameter='home_screen_designer.color_warning')
    hsd_color_danger = fields.Char("Danger Color", config_parameter='home_screen_designer.color_danger')
    hsd_color_brand_dark = fields.Char("Brand Color (Dark Mode)", config_parameter='home_screen_designer.color_brand_dark')
    hsd_color_primary_dark = fields.Char("Primary Color (Dark Mode)", config_parameter='home_screen_designer.color_primary_dark')
    hsd_color_navbar_dark = fields.Char("Top Bar Color (Dark Mode)", config_parameter='home_screen_designer.color_navbar_dark')

    # Installable web app (PWA)
    hsd_pwa_icon = fields.Binary(
        "App Icon", compute='_compute_hsd_pwa_icon', inverse='_inverse_hsd_pwa_icon')
    hsd_pwa_theme_color = fields.Char("App Theme Color", config_parameter='home_screen_designer.pwa_theme_color')
    hsd_pwa_background_color = fields.Char(
        "App Splash Color", config_parameter='home_screen_designer.pwa_background_color')

    # ------------------------------------------------------------------
    # PWA icon
    # ------------------------------------------------------------------
    @api.model
    def _hsd_pwa_icon_attachment(self):
        return self.env['ir.attachment'].sudo().search([
            ('res_model', '=', PWA_ICON_MODEL),
            ('name', '=', PWA_ICON_NAME),
        ], limit=1)

    def _compute_hsd_pwa_icon(self):
        attachment = self._hsd_pwa_icon_attachment()
        value = base64.b64encode(raw_bytes(attachment)).decode() if attachment else False
        for settings in self:
            settings.hsd_pwa_icon = value

    def _inverse_hsd_pwa_icon(self):
        if self.env.user._is_system():
            for settings in self:
                settings._hsd_save_pwa_icon()

    def _hsd_save_pwa_icon(self):
        attachment = self._hsd_pwa_icon_attachment()
        if not self.hsd_pwa_icon:
            attachment.unlink()
            return
        raw = self.hsd_pwa_icon
        raw = raw.content if hasattr(raw, 'content') else base64.b64decode(raw)
        try:
            # Square PNG, cropped on its center: what PWAs expect.
            png = image_process(raw, size=(PWA_ICON_SIDE, PWA_ICON_SIDE),
                                crop='center', output_format='PNG')
        except UserError:
            raise
        except Exception:
            raise UserError(self.env._("The app icon must be a PNG, JPEG or WEBP picture."))
        if attachment and raw_bytes(attachment) == png:
            return
        attachment.unlink()
        self.env['ir.attachment'].sudo().create({
            'name': PWA_ICON_NAME,
            'res_model': PWA_ICON_MODEL,
            'public': True,
            'mimetype': 'image/png',
            'raw': png,
        })

    # ------------------------------------------------------------------
    # Theme colors
    # ------------------------------------------------------------------
    def _hsd_colors(self, dark=False):
        keys = DARK_THEME_COLORS if dark else THEME_COLORS
        colors = {}
        for key in keys:
            value = (self[_color_field(key, dark)[0]] or '').strip()
            if value and not COLOR_RE.match(value):
                raise UserError(self.env._(
                    "%s is not a valid color: use the #RRGGBB format.", value))
            if value:
                colors[key] = value.lower()
        return colors

    @api.model
    def _hsd_scss(self, colors):
        lines = ["// Generated by Home Screen Designer (Settings > Home Screen)."]
        for key, value in colors.items():
            lines += [f"{var}: {value};" for var in THEME_COLORS[key]]
        return "\n".join(lines) + "\n"

    def _hsd_save_colors(self):
        light = self._hsd_colors()
        dark = self._hsd_colors(dark=True)
        self._hsd_write_color_file('light', light)
        self._hsd_write_color_file('dark', dark)

    @api.model
    def _hsd_write_color_file(self, scheme, colors):
        path, bundle = COLOR_FILES[scheme]
        url = CUSTOM_PREFIX + path
        Attachment = self.env['ir.attachment'].sudo().with_context(website_id=False)
        Asset = self.env['ir.asset'].sudo().with_context(active_test=False, website_id=False)
        attachment = Attachment.search([('url', '=', url)], limit=1)
        asset = Asset.search([('path', '=', url), ('target', '=', path)], limit=1)
        if not colors:
            # Back to Odoo's colors: drop the customization.
            if asset:
                asset.unlink()
            attachment.unlink()
            return
        content = self._hsd_scss(colors).encode()
        if attachment:
            if raw_bytes(attachment) != content:
                attachment.raw = content
        else:
            Attachment.create({
                'name': path.rsplit('/', 1)[-1],
                'type': 'binary',
                'url': url,
                'mimetype': 'text/scss',
                'raw': content,
            })
        vals = {
            'name': f"Home Screen Designer colors ({scheme})",
            'bundle': bundle,
            'directive': 'replace',
            'path': url,
            'target': path,
            'active': True,
        }
        if asset:
            # Rewriting the asset also invalidates the cached bundles.
            asset.write(vals)
        else:
            Asset.create(vals)

    def set_values(self):
        super().set_values()
        if self.env.user._is_system():
            self._hsd_save_colors()

    @api.model
    def _hsd_colors_signature(self):
        urls = [CUSTOM_PREFIX + path for path, _bundle in COLOR_FILES.values()]
        attachments = self.env['ir.attachment'].sudo().search([('url', 'in', urls)])
        return sorted((a.url, a.checksum) for a in attachments)

    def execute(self):
        before = self._hsd_colors_signature()
        result = super().execute()
        if self._hsd_colors_signature() != before:
            # New colors: reload to fetch the recompiled styles.
            return {'type': 'ir.actions.client', 'tag': 'reload'}
        return result

    def action_hsd_reset_colors(self):
        for key in THEME_COLORS:
            self.env['ir.config_parameter'].sudo().set_param(_color_field(key)[1], False)
        for key in DARK_THEME_COLORS:
            self.env['ir.config_parameter'].sudo().set_param(_color_field(key, True)[1], False)
        for scheme in COLOR_FILES:
            self._hsd_write_color_file(scheme, {})
        return {'type': 'ir.actions.client', 'tag': 'reload'}
