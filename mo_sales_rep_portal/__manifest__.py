{
    'name': 'Sales Representative Portal & Route Management',
    'version': '19.0.2.0.1',
    'summary': 'Mobile-first portal for sales reps: routes, visits (GPS), orders, invoices, payments and van stock on standard Odoo documents',
    'description': """
Sales Representative Portal & Route Management
==============================================
Portal interface + Route/Visit management + integration layer over standard Odoo
(sale.order, account.move, account.payment, stock.picking).
""",
    'category': 'Sales',
    'author': 'Eng. M.Aboelmagde',
    'website': 'https://www.youtube.com/@odoolab',
    'license': 'LGPL-3',
    'depends': ['base', 'mail', 'portal', 'hr', 'sales_team', 'sale_management', 'sale_stock', 'account', 'stock'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/data.xml',
        'views/backend_views.xml',
        'views/backend_views_v2.xml',
        'views/report_receipt.xml',
        'views/inherit_views.xml',
        'views/employee_views.xml',
        'views/menus.xml',
        'views/portal_templates.xml',
        'views/portal_templates_v2.xml',
        'views/portal_templates_v3.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'mo_sales_rep_portal/static/src/dashboard/dashboard.js',
            'mo_sales_rep_portal/static/src/dashboard/dashboard.xml',
            'mo_sales_rep_portal/static/src/dashboard/dashboard.scss',
        ],
    },
    'installable': True,
    'application': True,
}
