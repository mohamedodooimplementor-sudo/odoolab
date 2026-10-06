from . import controllers
from . import models


def uninstall_hook(env):
    """Give Odoo its own look back: drop the compiled theme colors (custom
    SCSS files and the assets replacing the module's files) and the app
    icon, which are records created at runtime, not module data."""
    from .models.res_config_settings import COLOR_FILES, PWA_ICON_MODEL, PWA_ICON_NAME
    Settings = env['res.config.settings']
    for scheme in COLOR_FILES:
        Settings._hsd_write_color_file(scheme, {})
    env['ir.attachment'].sudo().search([
        ('res_model', '=', PWA_ICON_MODEL),
        ('name', '=', PWA_ICON_NAME),
    ]).unlink()
    env['ir.config_parameter'].sudo().search([
        ('key', '=like', 'home_screen_designer.%'),
    ]).unlink()