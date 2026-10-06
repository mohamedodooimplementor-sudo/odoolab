"""Layout settings of the home screen: schema, defaults and sanitizing.

The same keys are mirrored in ``static/src/js/hsd_store.js``. Every value
received from the browser goes through :func:`sanitize` before being stored,
so the stored JSON only ever contains known keys with valid values.
"""

# key: (kind, default, bounds or choices)
SCHEMA = {
    # Layout
    'columns': ('int', 6, (3, 12)),
    'fit_screen': ('bool', False, None),
    'spacing': ('int', 16, (0, 48)),
    # Icons
    'icon_size': ('int', 64, (32, 128)),
    'radius': ('int', 22, (0, 50)),
    'font_size': ('int', 13, (10, 20)),
    'show_captions': ('bool', True, None),
    'caption_color': ('sel', 'auto', ('auto', 'light', 'dark')),
    # Background
    'bg_mode': ('sel', 'none', ('none', 'preset', 'image')),
    'bg_preset': ('sel', 'aurora', ('aurora', 'sunset', 'ocean', 'forest',
                                    'graphite', 'lavender', 'peach', 'night')),
    'bg_opacity': ('int', 100, (0, 100)),
    'bg_tint': ('sel', 'dark', ('light', 'dark')),
    'bg_blur': ('int', 0, (0, 20)),
    # Effects
    'glass': ('bool', False, None),
    'glass_blur': ('int', 14, (0, 40)),
    'anim_entrance': ('bool', True, None),
    'anim_hover': ('sel', 'lift', ('none', 'lift', 'bounce', 'grow')),
    # Header
    'greeting': ('bool', True, None),
    'clock': ('bool', True, None),
    'show_date': ('bool', True, None),
    'seconds': ('bool', False, None),
    # Search bar above the apps (Community home screen and Enterprise home menu)
    'search': ('bool', True, None),
    # Community home screen only
    'open_on_start': ('bool', True, None),
    # Apps: display order and apps hidden from the home screen / side bar
    # (lists of menu xmlids; access rights are not affected)
    'app_order': ('list', [], None),
    'hidden_apps': ('list', [], None),
    # Side bar of apps displayed inside the apps
    'sidebar': ('sel', 'off', ('off', 'icons', 'labels')),
    # Top bar (and side bar) inside the apps: brand color, or blended with
    # the page (light or dark like the views)
    'navbar_style': ('sel', 'surface', ('surface', 'color')),
    # Refresh button (and automatic refresh) in the control panel of views
    'refresh_button': ('bool', True, None),
}

MAX_LIST_ITEMS = 300
MAX_XMLID_LENGTH = 128

DEFAULTS = {key: spec[1] for key, spec in SCHEMA.items()}

COLOR_SCHEMES = [('system', "System"), ('light', "Light"), ('dark', "Dark")]

# Theme colors (Settings): key -> SCSS variables receiving the color.
# Written before Odoo's own variables, which are all "!default".
THEME_COLORS = {
    'brand': ('$o-community-color', '$o-enterprise-color', '$o-brand-odoo'),
    'primary': ('$o-brand-primary', '$o-enterprise-action-color', '$o-action'),
    'navbar': ('$o-navbar-background',),
    'success': ('$o-success',),
    'info': ('$o-info',),
    'warning': ('$o-warning',),
    'danger': ('$o-danger',),
}
# Colors that may get a different value in dark mode.
DARK_THEME_COLORS = ('brand', 'primary', 'navbar')


def sanitize(values):
    """Return a copy of ``values`` restricted to the known keys, with every
    value coerced to its type and clamped to its bounds. Unknown keys and
    invalid values are dropped."""
    clean = {}
    if not isinstance(values, dict):
        return clean
    for key, value in values.items():
        spec = SCHEMA.get(key)
        if not spec:
            continue
        kind, _default, extra = spec
        if kind == 'bool':
            clean[key] = bool(value)
        elif kind == 'int':
            try:
                number = int(round(float(value)))
            except (TypeError, ValueError):
                continue
            low, high = extra
            clean[key] = max(low, min(high, number))
        elif kind == 'sel' and value in extra:
            clean[key] = value
        elif kind == 'list' and isinstance(value, (list, tuple)):
            items = []
            for item in value[:MAX_LIST_ITEMS]:
                if (isinstance(item, str) and item
                        and len(item) <= MAX_XMLID_LENGTH and item not in items):
                    items.append(item)
            clean[key] = items
    return clean
