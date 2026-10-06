import io
import re

from PIL import Image

from odoo import http
from odoo.http import request
from odoo.tools import file_open

from odoo.addons.web.controllers.home import Home
from odoo.addons.web.controllers.webmanifest import WebManifest

from ..models.res_config_settings import PWA_ICON_MODEL, PWA_ICON_NAME, raw_bytes

COLOR_RE = re.compile(r'^#[0-9a-fA-F]{6}$')
# Sizes served for the installed app (Android / desktop / iOS / favicon).
ICON_SIZES = (64, 180, 192, 512)
DEFAULT_ICONS = {
    64: 'web/static/img/odoo-icon-192x192.png',
    180: 'web/static/img/odoo-icon-ios.png',
    192: 'web/static/img/odoo-icon-192x192.png',
    512: 'web/static/img/odoo-icon-512x512.png',
}


def _custom_icon():
    return request.env['ir.attachment'].sudo().search([
        ('res_model', '=', PWA_ICON_MODEL),
        ('name', '=', PWA_ICON_NAME),
    ], limit=1)


def _param_color(name):
    value = request.env['ir.config_parameter'].sudo().get_param(
        'home_screen_designer.' + name) or ''
    return value if COLOR_RE.match(value) else False


class HsdHome(Home):

    @http.route()
    def web_client(self, s_action=None, **kw):
        response = super().web_client(s_action, **kw)
        # Keep the cookie read by the web client (charts, editors...) in line
        # with the bundle that was served.
        if response.status_code == 200 and request.env.user \
                and not request.env.user._is_public() \
                and not request.env['ir.http']._hsd_native_color_scheme() \
                and request.env.user.sudo().hsd_color_scheme in ('light', 'dark'):
            response.set_cookie('color_scheme', request.env['ir.http'].color_scheme())
        return response


class HsdWebManifest(WebManifest):

    def _get_webmanifest(self):
        manifest = super()._get_webmanifest()
        attachment = _custom_icon()
        if attachment:
            version = attachment.checksum or attachment.id
            manifest['icons'] = [{
                'src': f'/home_screen_designer/pwa_icon/{size}.png?v={version}',
                'sizes': f'{size}x{size}',
                'type': 'image/png',
                'purpose': 'any',
            } for size in (192, 512)]
        theme = _param_color('pwa_theme_color')
        background = _param_color('pwa_background_color')
        if theme:
            manifest['theme_color'] = theme
        if background or theme:
            manifest['background_color'] = background or theme
        return manifest

    @http.route('/home_screen_designer/pwa_icon/<int:size>.png', type='http',
                auth='public', methods=['GET'], readonly=True)
    def hsd_pwa_icon(self, size, **kw):
        size = size if size in ICON_SIZES else 192
        attachment = _custom_icon()
        if attachment:
            # The stored icon is already square; resize it to the exact size
            # asked (Odoo's image tools never enlarge a picture).
            image = Image.open(io.BytesIO(raw_bytes(attachment))).convert('RGBA')
            buffer = io.BytesIO()
            image.resize((size, size), Image.LANCZOS).save(buffer, 'PNG', optimize=True)
            content = buffer.getvalue()
        else:
            with file_open(DEFAULT_ICONS[size], 'rb') as f:
                content = f.read()
        return request.make_response(content, headers=[
            ('Content-Type', 'image/png'),
            ('Cache-Control', 'public, max-age=86400'),
        ])
