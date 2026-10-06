from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    # Default home screen layout of the company, used by every user who has
    # not saved a personal layout.
    hsd_config = fields.Json(string="Home Screen Layout", copy=False)
    hsd_background = fields.Binary(
        string="Home Screen Background", attachment=True, copy=False)
    # Bumped on every background change: cache buster of the image URL.
    hsd_background_rev = fields.Integer(copy=False)
