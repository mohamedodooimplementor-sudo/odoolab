{
    'name': "Home Screen Designer - Dark Mode, Apps Sidebar, Backend Theme Colors & Auto Refresh",
    'version': '19.0.1.0.3',
    'category': 'Themes/Backend',
    'summary': "Backend theme for Odoo Community and Enterprise: customizable home "
               "screen and Enterprise home menu, dark mode, apps sidebar, app order, "
               "theme colors, custom PWA app icon and auto refresh of the views.",
    'description': """
Home Screen Designer
====================

Personalize the home screen of Odoo, live, from a panel opened from the top
bar:

* **Layout**: number of columns (3 to 12) or fit to the screen width, spacing;
* **Icons**: size, corner radius, text size and color, app names on / off;
* **Backgrounds**: 8 gradients or your own picture, with visibility, light or
  dark overlay and blur;
* **Glassmorphism** tiles, **entrance animation** and **hover effects**;
* **Greeting and clock** with the date;
* **Per user** layouts, and a **company layout** set by the administrators
  for everyone who has not personalized theirs;
* **Apps order**: drag and drop the apps, hide the ones you never use;
* **Side bar of apps** to jump from an app to another;
* **Dark mode** switch (light / dark / follow the system), Community too;
* **Theme colors**: brand, primary, top bar and status colors, compiled into
  Odoo's styles, with dark mode variants;
* **Installable app**: custom icon and colors when Odoo is installed on a
  phone or a computer;
* **Refresh button** in the views, with an **automatic refresh** (15 seconds
  to 30 minutes) that pauses while you edit or select records.

Works with **Odoo Community** (the module adds a full screen home screen
with a search on the apps and menus, opened from the apps button and after
login) and with **Odoo Enterprise**, whose native home menu (the Enterprise
home menu) is customized.
    """,
    'author': "Aurélien Robert",
    'website': 'https://nextconception.fr/module-home-screen-designer.html',
    'license': 'OPL-1',
    'depends': ['web'],
    'data': [
        'data/home_action.xml',
        'views/res_users_views.xml',
        'views/res_config_settings_views.xml',
        'views/webclient_templates.xml',
    ],
    'assets': {
        # Theme colors: these (empty) files are replaced by attachments when
        # colors are set in the settings. The dark one is only replaced in
        # the dark bundle.
        'web._assets_primary_variables': [
            ('before', 'web/static/src/scss/primary_variables.scss',
             'home_screen_designer/static/src/scss/hsd_colors.scss'),
            ('before', 'web/static/src/scss/primary_variables.scss',
             'home_screen_designer/static/src/scss/hsd_colors_dark.scss'),
        ],
        # Dark palette: Odoo Community has the dark bundle but no palette.
        'web.assets_web_dark': [
            ('before', 'web/static/src/scss/primary_variables.scss',
             'home_screen_designer/static/src/scss/dark/hsd_dark_primary.scss'),
            ('before', 'web/static/src/scss/bootstrap_overridden.scss',
             'home_screen_designer/static/src/scss/dark/hsd_dark_bootstrap.scss'),
            'home_screen_designer/static/src/scss/dark/hsd_dark_rules.scss',
        ],
        'web.assets_backend': [
            'home_screen_designer/static/src/scss/home_screen_designer.scss',
            'home_screen_designer/static/src/js/hsd_store.js',
            'home_screen_designer/static/src/js/hsd_service.js',
            'home_screen_designer/static/src/js/hsd_header.js',
            'home_screen_designer/static/src/js/hsd_home.js',
            'home_screen_designer/static/src/js/hsd_panel.js',
            'home_screen_designer/static/src/js/hsd_systray.js',
            'home_screen_designer/static/src/js/hsd_sidebar.js',
            'home_screen_designer/static/src/js/hsd_color_scheme.js',
            'home_screen_designer/static/src/js/hsd_refresh.js',
            'home_screen_designer/static/src/js/hsd_patches.js',
            'home_screen_designer/static/src/xml/home_screen_designer.xml',
        ],
    },
    'images': ['static/description/banner.png'],
    'uninstall_hook': 'uninstall_hook',
    'installable': True,
    'application': False,
}
