# Gets kits from database and sents it to the frontend
from flask import Blueprint, jsonify
from models import SystemTemplate, SystemTemplateComponent, Product

system_templates_bp = Blueprint('system_templates', __name__)

@system_templates_bp.route('/system_templates', methods=['GET'])
def get_system_templates():
    templates = SystemTemplate.query.all()
    results = []

    for template in templates:
        # Calculate totals for each template on the backend
        total_cost = template.extras_cost or 0
        panel_kw = 0
        inverter_kva = 0
        battery_kwh = 0
        components_list = []

        for comp in template.components:
            if comp.product:
                cat = (comp.product.category or '').lower()
                total_cost += (comp.product.price or 0) * comp.quantity
                if cat == 'panel':
                    panel_kw += (comp.product.power_w or 0) * comp.quantity / 1000
                elif cat == 'inverter':
                    inverter_kva += (comp.product.rating_kva or 0) * comp.quantity # MOET INVERTERS BY MEKAAR GETEL WORD? 
                elif cat == 'battery':
                    battery_kwh += (comp.product.capacity_kwh or 0) * comp.quantity

                components_list.append({
                    'product_id': comp.product.id,
                    'brand': comp.product.brand,
                    'model': comp.product.model,
                    'quantity': comp.quantity,
                    'category': comp.product.category
                })

        results.append({
            'id': template.id,
            'name': template.name,
            'description': template.description,
            'system_type': template.system_type,
            'total_cost': total_cost,
            'panel_kw': round(panel_kw, 2),
            'inverter_kva': round(inverter_kva, 2),
            'battery_kwh': round(battery_kwh, 2),
            'components': components_list # Send the detailed components list
        })

    return jsonify(results), 200